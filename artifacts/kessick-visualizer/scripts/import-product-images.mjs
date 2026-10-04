#!/usr/bin/env node

import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const APP_ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_CATALOG = join(APP_ROOT, 'public/data/kessick-products.json');
const DEFAULT_DESTINATION = join(APP_ROOT, 'public/assets/kessick-products');
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const INVOCATION_ROOT = process.env.INIT_CWD ?? process.cwd();
const execFileAsync = promisify(execFile);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { catalog: DEFAULT_CATALOG, destination: DEFAULT_DESTINATION };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (argument === '--source' || argument === '--catalog' || argument === '--destination') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`Missing value after ${argument}.`);
      options[argument.slice(2)] = resolve(INVOCATION_ROOT, value);
      index += 1;
    } else {
      fail(`Unknown argument "${argument}". Use --source <approved-image-directory>.`);
    }
  }
  if (!options.source) fail('Missing required --source <approved-image-directory>.');
  return options;
}

async function listFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    fail(`Cannot read approved image directory "${directory}": ${error.message}`);
  }

  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function sourceFilename(product) {
  const provenance = product.source_image_url ?? product.image_url;
  if (typeof provenance !== 'string' || provenance.trim() === '') {
    fail(`Product "${product.id ?? '(missing id)'}" has no source_image_url provenance.`);
  }

  let filename;
  try {
    filename = decodeURIComponent(new URL(provenance).pathname.split('/').pop() ?? '');
  } catch {
    fail(`Product "${product.id}" has an invalid source image URL: ${provenance}`);
  }
  return { provenance, filename };
}

function normalizeCatalog(catalog) {
  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    fail('Catalog must contain a nonempty products array.');
  }

  const ids = new Set();
  const normalizedProducts = catalog.products.map((product) => {
    if (typeof product.id !== 'string' || product.id.trim() === '') fail('Every product must have a nonempty id.');
    if (ids.has(product.id)) fail(`Duplicate product id "${product.id}".`);
    ids.add(product.id);

    const { provenance, filename: provenanceFilename } = sourceFilename(product);
    const imageFile = product.image_file ?? provenanceFilename;
    if (typeof imageFile !== 'string' || imageFile !== basename(imageFile) || imageFile.trim() === '') {
      fail(`Product "${product.id}" has an unsafe image_file "${imageFile}". Use a filename only.`);
    }
    const extension = extname(imageFile).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      fail(`Product "${product.id}" uses unsupported image "${imageFile}". Supported: JPG, JPEG, PNG, WEBP.`);
    }

    const { image_url: _legacyRemoteUrl, ...rest } = product;
    return { ...rest, image_file: imageFile, source_image_url: provenance };
  });

  return { ...catalog, products: normalizedProducts };
}

async function assertNonempty(path, label) {
  let details;
  try {
    details = await stat(path);
  } catch {
    fail(`${label} is missing: ${path}`);
  }
  if (!details.isFile() || details.size === 0) fail(`${label} is empty or not a file: ${path}`);
}

async function validateImageBytes(path) {
  const bytes = await readFile(path);
  const extension = extname(path).toLowerCase();
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  const matchesExtension =
    ((extension === '.jpg' || extension === '.jpeg') && isJpeg) ||
    (extension === '.png' && isPng) ||
    (extension === '.webp' && isWebp);

  if (!matchesExtension) {
    fail(`Approved file content does not match its supported image extension: ${path}`);
  }
  return createHash('sha256').update(bytes).digest('hex');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rawCatalog = JSON.parse(await readFile(options.catalog, 'utf8'));
  const catalog = normalizeCatalog(rawCatalog);
  const approvedFiles = await listFiles(options.source);
  if (approvedFiles.length === 0) fail(`No approved image files found in "${options.source}".`);

  const approvedByName = new Map();
  const approvedByHash = new Map();
  for (const file of approvedFiles) {
    const name = basename(file);
    const extension = extname(name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      fail(`Unsupported approved file "${file}". Supported: JPG, JPEG, PNG, WEBP.`);
    }
    const key = name.toLowerCase();
    if (approvedByName.has(key)) {
      fail(`Duplicate approved filename "${name}" (filenames are matched case-insensitively):\n- ${approvedByName.get(key)}\n- ${file}`);
    }
    await assertNonempty(file, 'Approved image');
    const hash = await validateImageBytes(file);
    if (approvedByHash.has(hash)) {
      fail(`Duplicate approved image content:\n- ${approvedByHash.get(hash)}\n- ${file}\nReference one shared image_file instead of copying the same image under multiple names.`);
    }
    approvedByName.set(key, file);
    approvedByHash.set(hash, file);
  }

  const requiredNames = new Set(catalog.products.map((product) => product.image_file));
  const unreferenced = [...approvedByName.keys()].filter(
    (key) => ![...requiredNames].some((name) => name.toLowerCase() === key),
  );
  if (unreferenced.length) {
    fail(`Approved files are not referenced by any catalog product: ${unreferenced.join(', ')}`);
  }

  const stage = await mkdtemp(join(tmpdir(), 'kessick-product-images-'));
  try {
    for (const name of requiredNames) {
      const approved = approvedByName.get(name.toLowerCase());
      const existing = join(options.destination, name);
      const source = approved ?? existing;
      if (!approved) {
        try {
          await assertNonempty(existing, `Local image required by catalog (${name})`);
        } catch {
          fail(`Missing image "${name}". Add that explicitly approved file to --source, or keep a nonempty copy in "${options.destination}".`);
        }
      }
      await copyFile(source, join(stage, name));
      await assertNonempty(join(stage, name), `Staged image (${name})`);
    }

    await mkdir(options.destination, { recursive: true });
    for (const name of requiredNames) {
      await copyFile(join(stage, name), join(options.destination, name));
    }
    await writeFile(options.catalog, `${JSON.stringify(catalog, null, 2)}\n`);
    await execFileAsync(process.execPath, [
      join(APP_ROOT, 'scripts/generate-product-thumbnails.mjs'),
      '--catalog',
      options.catalog,
      '--source',
      options.destination,
      '--destination',
      join(options.destination, 'thumbnails'),
    ]);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }

  console.log(`Imported ${approvedFiles.length} approved image(s); validated ${catalog.products.length} products and ${requiredNames.size} local image(s).`);
}

main().catch((error) => {
  console.error(`Catalog image import failed:\n${error.message}`);
  process.exitCode = 1;
});
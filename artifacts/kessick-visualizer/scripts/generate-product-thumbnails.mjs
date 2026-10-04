#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { basename, dirname, join, resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const APP_ROOT = resolve(import.meta.dirname, '..');
const INVOCATION_ROOT = process.env.INIT_CWD ?? process.cwd();
const DEFAULT_CATALOG = join(APP_ROOT, 'public/data/kessick-products.json');
const DEFAULT_SOURCE = join(APP_ROOT, 'public/assets/kessick-products');
const DEFAULT_DESTINATION = join(DEFAULT_SOURCE, 'thumbnails');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    catalog: DEFAULT_CATALOG,
    source: DEFAULT_SOURCE,
    destination: DEFAULT_DESTINATION,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (argument === '--catalog' || argument === '--source' || argument === '--destination') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`Missing value after ${argument}.`);
      options[argument.slice(2)] = resolve(INVOCATION_ROOT, value);
      index += 1;
    } else {
      fail(`Unknown argument "${argument}".`);
    }
  }

  return options;
}

function thumbnailFilename(imageFile) {
  if (typeof imageFile !== 'string' || imageFile !== basename(imageFile) || imageFile.trim() === '') {
    fail(`Unsafe catalog image_file "${imageFile}". Use a filename only.`);
  }
  return `${imageFile}.webp`;
}

async function assertImage(path) {
  try {
    const details = await stat(path);
    if (!details.isFile() || details.size === 0) throw new Error('not a nonempty file');
  } catch {
    fail(`Catalog original is missing or empty: ${path}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const catalog = JSON.parse(await readFile(options.catalog, 'utf8'));
  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    fail('Catalog must contain a nonempty products array.');
  }

  const imageFiles = [...new Set(catalog.products.map((product) => product.image_file))].sort();
  const destinationParent = dirname(options.destination);
  await mkdir(destinationParent, { recursive: true });
  const stageRoot = await mkdtemp(join(destinationParent, '.thumbnail-stage-'));
  const stagedThumbnails = join(stageRoot, 'thumbnails');
  await mkdir(stagedThumbnails);

  try {
    for (const imageFile of imageFiles) {
      const original = join(options.source, imageFile);
      const thumbnail = join(stagedThumbnails, thumbnailFilename(imageFile));
      await assertImage(original);
      try {
        await execFileAsync('magick', [
          original,
          '-auto-orient',
          '-strip',
          '-resize',
          '640x480>',
          '-quality',
          '78',
          '-define',
          'webp:method=6',
          thumbnail,
        ]);
      } catch (error) {
        fail(`Could not generate thumbnail for "${imageFile}": ${error.message}`);
      }
      await assertImage(thumbnail);
    }

    const previousDestination = `${options.destination}.previous`;
    await rm(previousDestination, { recursive: true, force: true });
    try {
      await rename(options.destination, previousDestination);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await rename(stagedThumbnails, options.destination);
    await rm(previousDestination, { recursive: true, force: true });
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }

  console.log(`Generated ${imageFiles.length} optimized product thumbnail(s).`);
}

main().catch((error) => {
  console.error(`Product thumbnail generation failed:\n${error.message}`);
  process.exitCode = 1;
});
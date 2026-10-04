import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { PDFDocument, PDFName, StandardFonts } from "pdf-lib";

test("production ESM bundle resolves isolated PDF worker dependencies and enforces policy", async () => {
  const artifact = fileURLToPath(new URL("../../", import.meta.url));
  const temp = await mkdtemp(path.join(artifact, ".knowledge-bundle-test-"));
  try {
    const outfile = path.join(temp, "index.mjs");
    // Same relevant build.mjs settings: Node, bundled ESM, native sharp external,
    // createRequire banner, and import.meta.url belonging to the emitted bundle.
    await build({
      entryPoints: [fileURLToPath(new URL("./knowledgeExtraction.ts", import.meta.url))],
      outfile, bundle: true, platform: "node", format: "esm",
      external: ["sharp", "@google-cloud/*"],
      banner: { js: `import { createRequire as __bannerCrReq } from 'node:module'; globalThis.require = __bannerCrReq(import.meta.url);` },
      logLevel: "silent",
    });
    const { extractKnowledge } = await import(pathToFileURL(outfile).href);
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage().drawText("Production bundle knowledge extraction", { font });
    assert.match(await extractKnowledge(Buffer.from(await pdf.save()), "application/pdf"), /Production bundle knowledge extraction/);
    pdf.catalog.set(PDFName.of("OpenAction"), pdf.context.obj({ S: "JavaScript", JS: "alert(1)" }));
    await assert.rejects(extractKnowledge(Buffer.from(await pdf.save()), "application/pdf"), /PDF rejected/);
    const blank = await PDFDocument.create(); blank.addPage();
    await assert.rejects(extractKnowledge(Buffer.from(await blank.save()), "application/pdf"), /OCR/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
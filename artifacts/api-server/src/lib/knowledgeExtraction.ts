import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { pdfPolicyWorkerSource } from "./uploadSecurity";

const require = createRequire(import.meta.url);
export const KNOWLEDGE_MAX_TEXT = 200_000;
export async function extractKnowledge(data: Buffer, contentType: string): Promise<string> {
  if (data.length > 10 * 1024 * 1024) throw new Error("Document exceeds 10 MiB.");
  if (contentType === "text/plain") {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(data); }
    catch { throw new Error("TXT must contain valid UTF-8 text."); }
    if (text.includes("\0") || text.startsWith("#!")) throw new Error("Unsafe plain-text file.");
    if (!text.trim()) throw new Error("Document contains no searchable text.");
    if (text.length > KNOWLEDGE_MAX_TEXT) throw new Error("Text exceeds 200,000 characters.");
    return text;
  }
  if (contentType !== "application/pdf") throw new Error("Only PDF and TXT are supported.");
  return new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require("node:worker_threads");
      const { createRequire } = require("node:module");
      const localRequire = createRequire(workerData.base);
      const originalRequire = require;
      require = localRequire;
      ${pdfPolicyWorkerSource}
      (async () => {
        const data = Buffer.from(workerData.bytes);
        if (!(await validatePdfBytes(data))) throw new Error("PDF rejected: encrypted, incremental, malformed, or active content. Remove scripts, actions, links, forms and embedded files.");
        const { getDocument } = await import(workerData.pdfjs);
        const task = getDocument({data:new Uint8Array(data), isEvalSupported:false, useSystemFonts:false, disableFontFace:true, stopAtErrors:true, maxImageSize:1000000, verbosity:0});
        const pdf = await task.promise;
        if (pdf.numPages > 100) throw new Error("PDF exceeds 100 pages.");
        let text = "";
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          text += content.items.map(i => typeof i.str === "string" ? i.str : "").join(" ") + "\\n";
          if(text.length > 200000) throw new Error("Text exceeds 200,000 characters.");
          page.cleanup();
        }
        await task.destroy();
        if (!text.trim()) throw new Error("No searchable PDF text. Scanned PDFs need OCR, which is not supported.");
        parentPort.postMessage({text});
      })().catch(e => parentPort.postMessage({error:e.message}));
    `, {
      eval: true,
      workerData: { bytes: data, base: import.meta.url, pdfjs: require.resolve("pdfjs-dist/legacy/build/pdf.mjs") },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("PDF extraction exceeded 15 seconds. Split the document.")); }, 15_000);
    worker.once("message", (result) => {
      clearTimeout(timer); void worker.terminate();
      if (result.error) reject(new Error(result.error)); else resolve(result.text);
    });
    worker.once("error", () => { clearTimeout(timer); reject(new Error("PDF extraction failed within safety limits.")); });
    worker.once("exit", (code) => { clearTimeout(timer); if (code !== 0) reject(new Error("PDF extraction stopped within safety limits.")); });
  });
}
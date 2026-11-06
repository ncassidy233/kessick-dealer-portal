import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

async function outputFiles(directory: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${item.name}`;
    if (item.isDirectory()) files.push(...await outputFiles(path.join(directory, item.name), `${name}/`));
    else if (item.isFile()) files.push(name);
  }
  return files.sort();
}

function withoutReleaseMeta(html: string): string {
  return html.replace(/<meta\b[^>]*>/gi, tag =>
    /\sname\s*=\s*["']kessick-release["']/i.test(tag) ? "" : tag);
}

function withoutWorkerRelease(worker: string): string {
  return worker.replace(/\n\/\/ Application release: [^\r\n]+\r?\n?$/, "");
}

/** Give installed clients an explicit release and update the existing worker. */
export function appRelease(): Plugin {
  return {
    name: "kessick-app-release",
    apply: "build",
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(item => item.type === "chunk" && item.isEntry);
      if (!entry) throw new Error("The portal application entry is missing.");
      const commit = process.env.RENDER_GIT_COMMIT;
      this.emitFile({ type: "asset", fileName: "app-version.json", source: JSON.stringify({
        schemaVersion: 1, entry: entry.fileName,
        ...(commit && /^[a-f0-9]{40}$/.test(commit) ? { commit } : {}),
      }) });
    },
    writeBundle: {
      order: "post",
      sequential: true,
      async handler(options, bundle) {
        const entry = Object.values(bundle).find(item => item.type === "chunk" && item.isEntry);
        if (!entry || !options.dir) return;
        const directory = path.resolve(options.dir);
        const commit = process.env.RENDER_GIT_COMMIT;
        const releaseCommit = commit && /^[a-f0-9]{40}$/.test(commit) ? commit : undefined;
        const hash = createHash("sha256").update("kessick-app-release-v1\0").update(releaseCommit ?? "");
        // Run after Vite writes HTML, CSS, chunks and copied public assets. Exclude
        // our own markers so identical output always has the same fingerprint.
        for (const name of await outputFiles(directory)) {
          if (name === "app-version.json") continue;
          let content = await readFile(path.join(directory, name));
          if (name === "index.html") content = Buffer.from(withoutReleaseMeta(content.toString("utf8")));
          if (name === "sw.js") content = Buffer.from(withoutWorkerRelease(content.toString("utf8")));
          hash.update(`${name.length}:${name}:${content.length}:`).update(content);
        }
        const releaseId = hash.digest("hex");
        const htmlPath = path.join(directory, "index.html");
        const html = withoutReleaseMeta(await readFile(htmlPath, "utf8"));
        if (!/<\/head>/i.test(html)) throw new Error("The portal entry document is missing its head.");
        await writeFile(htmlPath, html.replace(/<\/head>/i, `<meta name="kessick-release" content="${releaseId}"></head>`));
        await writeFile(path.join(directory, "app-version.json"), JSON.stringify({
          schemaVersion: 1, entry: entry.fileName, releaseId,
          ...(releaseCommit ? { commit: releaseCommit } : {}),
        }));
        const workerPath = path.join(directory, "sw.js");
        const worker = withoutWorkerRelease(await readFile(workerPath, "utf8"));
        await writeFile(workerPath, `${worker}\n// Application release: ${releaseId}\n`);
      },
    },
  };
}

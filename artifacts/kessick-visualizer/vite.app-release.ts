import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

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
    async writeBundle(options, bundle) {
      const entry = Object.values(bundle).find(item => item.type === "chunk" && item.isEntry);
      if (!entry || !options.dir) return;
      const workerPath = path.resolve(options.dir, "sw.js");
      const worker = await readFile(workerPath, "utf8");
      await writeFile(workerPath, `${worker}\n// Application release: ${entry.fileName}\n`);
    },
  };
}

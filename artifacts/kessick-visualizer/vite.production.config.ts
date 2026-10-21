import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const appDir = import.meta.dirname;

export default defineConfig({
  configFile: false,
  root: appDir,
  base: "/",
  plugins: [react(), tailwindcss({ optimize: false })],
  resolve: {
    alias: {
      "@": path.resolve(appDir, "src"),
      "@assets": path.resolve(appDir, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: path.resolve(appDir, "dist/public"),
    emptyOutDir: true,
  },
});

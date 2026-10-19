/**
 * Serves the compiled dealer portal (artifacts/kessick-visualizer/dist/public)
 * from the API process, so the portal, the API and the Clerk proxy share one
 * origin on hosts without Replit's path router (e.g. a single Render web
 * service). Mirrors scripts/serve-secure-static.mjs: GET/HEAD only, no
 * dotfiles, missing assets 404, extensionless paths fall back to index.html.
 *
 * Enabled only when PORTAL_STATIC_DIR is set; mount after every /api handler.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import express, { type RequestHandler, Router } from "express";

export function portalStaticRouter(
  directory = process.env.PORTAL_STATIC_DIR,
): Router | null {
  if (!directory) return null;
  const root = path.resolve(directory);
  const indexFile = path.join(root, "index.html");
  if (!existsSync(indexFile)) {
    throw new Error(`PORTAL_STATIC_DIR has no index.html: ${root}`);
  }

  const router = Router();

  router.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nDisallow: /\n");
  });

  router.use(
    express.static(root, {
      dotfiles: "deny",
      index: ["index.html"],
      redirect: false,
      // Keep the no-store Cache-Control set by securityHeaders.
      cacheControl: false,
      lastModified: false,
    }),
  );

  const spaFallback: RequestHandler = (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (path.extname(req.path) || req.path.split("/").some((s) => s.startsWith("."))) {
      res.status(404).type("text/plain").send("Not found.");
      return;
    }
    res.sendFile(indexFile);
  };
  router.use(spaFallback);

  return router;
}

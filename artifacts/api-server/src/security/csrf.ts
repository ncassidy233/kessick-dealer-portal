import type { RequestHandler } from "express";
import { logger } from "../lib/logger";
import { isAllowedRequestOrigin } from "./origin";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const OAUTH_FORM_PATHS = new Set(["/oauth/authorize", "/oauth/token", "/oauth/revoke"]);
const CROSS_ORIGIN_OAUTH_PATHS = new Set(["/oauth/token", "/oauth/revoke"]);
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PROJECT_UPLOAD_PATH = new RegExp(`^/projects/${UUID}/images/uploads/${UUID}$`, "i");
const RESOURCE_UPLOAD_PATH = new RegExp(`^/staff/portal/resource-uploads/${UUID}$`, "i");
const KNOWLEDGE_UPLOAD_PATH = new RegExp(`^/staff/concierge/knowledge/uploads/${UUID}$`, "i");
const PROJECT_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RESOURCE_UPLOAD_TYPES = new Set([
  ...PROJECT_UPLOAD_TYPES,
  "application/pdf",
  "text/plain",
]);

function isRawUpload(req: Parameters<RequestHandler>[0]): boolean {
  if (req.method !== "PUT") return false;
  const contentType = req.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  if (PROJECT_UPLOAD_PATH.test(req.path)) return PROJECT_UPLOAD_TYPES.has(contentType);
  if (RESOURCE_UPLOAD_PATH.test(req.path)) return RESOURCE_UPLOAD_TYPES.has(contentType);
  if (KNOWLEDGE_UPLOAD_PATH.test(req.path)) return ["application/pdf", "text/plain"].includes(contentType);
  return false;
}

export function csrfGuard(allowedOrigins: ReadonlySet<string>): RequestHandler {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const oauthForm = OAUTH_FORM_PATHS.has(req.path);
    const oauthProtocolEndpoint = CROSS_ORIGIN_OAUTH_PATHS.has(req.path);
    const hasBearerAuth = /^(?:Bearer|Basic) /i.test(req.get("authorization") ?? "");
    const fetchSite = req.get("sec-fetch-site")?.toLowerCase();
    const rawUpload = isRawUpload(req);
    const contentTypeValid =
      req.is("application/json") ||
      (oauthForm && req.is("application/x-www-form-urlencoded")) ||
      (rawUpload && req.get("x-kessick-csrf") === "1");

    if (!contentTypeValid) {
      logger.warn({ event: "security.csrf_rejected", reason: "content_type", method: req.method, path: req.path }, "Rejected unsafe request");
      res.status(415).json({ error: oauthForm ? "Unsupported content type." : "JSON content type required." });
      return;
    }

    // Token and revocation endpoints authenticate explicit OAuth credentials;
    // they do not use ambient browser cookies and must remain usable by clients.
    if (oauthProtocolEndpoint && !req.get("cookie")) return next();

    if (fetchSite === "cross-site" || fetchSite === "none") {
      logger.warn({ event: "security.csrf_rejected", reason: "fetch_metadata", method: req.method, path: req.path }, "Rejected unsafe request");
      res.status(403).json({ error: "Cross-site request rejected." });
      return;
    }

    if (hasBearerAuth && !req.get("cookie")) return next();

    if (!isAllowedRequestOrigin(req, allowedOrigins)) {
      logger.warn({ event: "security.csrf_rejected", reason: "origin", method: req.method, path: req.path }, "Rejected unsafe request");
      res.status(403).json({ error: "Request origin could not be verified." });
      return;
    }
    next();
  };
}
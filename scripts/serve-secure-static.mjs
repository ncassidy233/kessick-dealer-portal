import http from "node:http";
import https from "node:https";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Production-only static delivery. Never serve the workspace or source files.
export const browserPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com https://*.clerk.accounts.dev https://*.clerk.com",
  "script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev https://challenges.cloudflare.com https://accounts.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Staff-managed product/reference imagery supports external HTTPS sources.
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "connect-src 'self' data: blob: https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev https://accounts.google.com https://challenges.cloudflare.com",
  "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev https://accounts.google.com https://challenges.cloudflare.com https://www.google.com https://www.recaptcha.net",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export function staticHeaders() {
  return {
    "Content-Security-Policy": browserPolicy,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), xr-spatial-tracking=(self)",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Cache-Control": "private, no-store",
  };
}

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function endToEndHeaders(headers) {
  const excluded = new Set(hopByHopHeaders);
  for (const value of headers.connection?.split(",") ?? []) {
    excluded.add(value.trim().toLowerCase());
  }
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name, value]) =>
        value !== undefined && !excluded.has(name.toLowerCase()),
    ),
  );
}

export function normalizeApiOrigin(value) {
  if (!value) return null;
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
    ? value
    : `https://${value}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("API_ORIGIN must be a valid HTTPS origin.");
  }
  const localHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "API_ORIGIN must be an HTTPS origin without credentials or a path.",
    );
  }
  return url;
}

function proxyApiRequest(req, res, apiOrigin, base) {
  if (!apiOrigin) {
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "The API service is not configured." }));
    return;
  }

  let targetPath;
  try {
    const incoming = new URL(req.url ?? "/", "http://static.invalid");
    const basePrefix = base === "/" ? "" : base.slice(0, -1);
    targetPath = `${incoming.pathname.slice(basePrefix.length)}${incoming.search}`;
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Invalid request.");
    return;
  }

  const headers = endToEndHeaders(req.headers);
  headers.host = apiOrigin.host;
  for (const header of [
    "forwarded",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-port",
    "x-forwarded-proto",
    "x-real-ip",
  ]) {
    delete headers[header];
  }
  if (req.headers.host) headers["x-forwarded-host"] = req.headers.host;
  headers["x-forwarded-proto"] = "https";
  if (req.socket.remoteAddress)
    headers["x-forwarded-for"] = req.socket.remoteAddress;
  const transport = apiOrigin.protocol === "https:" ? https : http;
  const upstream = transport.request(
    {
      hostname: apiOrigin.hostname,
      port: apiOrigin.port || undefined,
      method: req.method,
      path: targetPath,
      headers,
      timeout: 35_000,
    },
    (response) => {
      const responseHeaders = endToEndHeaders(response.headers);
      for (const header of Object.keys(staticHeaders())) {
        delete responseHeaders[header.toLowerCase()];
      }
      res.writeHead(response.statusCode ?? 502, responseHeaders);
      response.pipe(res);
    },
  );
  upstream.on("timeout", () =>
    upstream.destroy(new Error("API request timed out.")),
  );
  upstream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "The API service is unavailable." }));
    } else {
      res.destroy();
    }
  });
  req.on("aborted", () => upstream.destroy());
  res.on("close", () => {
    if (!res.writableEnded) upstream.destroy();
  });
  req.pipe(upstream);
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".pdf": "application/pdf",
};

export async function createStaticServer(
  directory,
  basePath = "/",
  configuredApiOrigin = process.env.API_ORIGIN,
) {
  const root = await realpath(directory);
  const base = basePath === "/" ? "/" : `/${basePath.replace(/^\/|\/$/g, "")}/`;
  const apiOrigin = normalizeApiOrigin(configuredApiOrigin);
  const server = http.createServer(async (req, res) => {
    for (const [key, value] of Object.entries(staticHeaders()))
      res.setHeader(key, value);
    const fail = (status, message) => {
      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : message);
    };
    let pathname;
    try {
      pathname = decodeURIComponent((req.url ?? "/").split("?")[0]);
    } catch {
      return fail(400, "Invalid request.");
    }
    if (
      pathname.length > 2048 ||
      /[\0\\]/.test(pathname) ||
      pathname.split("/").some((segment) => segment.startsWith("."))
    )
      return fail(404, "Not found.");
    if (base !== "/" && pathname === base.slice(0, -1)) {
      res.writeHead(308, { Location: base });
      return res.end();
    }
    if (!pathname.startsWith(base)) return fail(404, "Not found.");
    const relative = pathname.slice(base.length);
    if (/^api(?:\/|$)/.test(relative)) {
      if (
        !["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(
          req.method ?? "",
        )
      ) {
        res.setHeader("Allow", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
        return fail(405, "Method not allowed.");
      }
      return proxyApiRequest(req, res, apiOrigin, base);
    }
    if (!["GET", "HEAD"].includes(req.method ?? "")) {
      res.setHeader("Allow", "GET, HEAD");
      return fail(405, "Method not allowed.");
    }
    if (/^(api|__mockup|__e2e)(\/|$)/.test(relative))
      return fail(404, "Not found.");
    if (relative === "robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(
        req.method === "HEAD" ? undefined : "User-agent: *\nDisallow: /\n",
      );
    }
    try {
      let file = path.resolve(root, relative || "index.html");
      if (file !== root && !file.startsWith(root + path.sep))
        return fail(404, "Not found.");
      let metadata;
      try {
        metadata = await stat(file);
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
      }
      if (!metadata?.isFile()) {
        if (path.extname(relative)) return fail(404, "Not found.");
        file = path.join(root, "index.html");
        metadata = await stat(file);
      }
      const resolved = await realpath(file);
      if (!resolved.startsWith(root + path.sep)) return fail(404, "Not found.");
      const contentType = mime[path.extname(file).toLowerCase()];
      if (!contentType) return fail(404, "Not found.");
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": metadata.size,
      });
      if (req.method === "HEAD") return res.end();
      createReadStream(resolved)
        .on("error", () => res.destroy())
        .pipe(res);
    } catch {
      if (!res.headersSent) fail(500, "The request could not be completed.");
      else res.destroy();
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.setTimeout(30_000, (socket) => socket.destroy());
  server.maxHeadersCount = 50;
  return server;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !process.argv[2]) {
    console.error(
      "Static service requires a valid PORT and compiled public directory.",
    );
    process.exit(1);
  }
  const server = await createStaticServer(
    process.argv[2],
    process.env.BASE_PATH ?? "/",
  );
  server.listen(port, "0.0.0.0", () =>
    console.info("Secure static service ready."),
  );
}

import type { Request } from "express";

function parseOrigin(value: string): string | null {
  const candidate = value.includes("://") ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function configuredOrigins(env: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  const values = [
    ...(env.REPLIT_DOMAINS ?? "").split(","),
    ...(env.KESSICK_ALLOWED_ORIGINS ?? "").split(","),
    ...(env.NODE_ENV === "development"
      ? ["http://localhost", "http://localhost:5173", "http://127.0.0.1:5173"]
      : []),
  ];
  return new Set(values.map((value) => parseOrigin(value.trim())).filter((value): value is string => Boolean(value)));
}

export function requestSourceOrigin(req: Pick<Request, "get">): string | null {
  const origin = req.get("origin");
  if (origin) return parseOrigin(origin);
  const referer = req.get("referer");
  if (!referer) return null;
  try {
    return parseOrigin(new URL(referer).origin);
  } catch {
    return null;
  }
}

export function isAllowedRequestOrigin(
  req: Pick<Request, "get">,
  allowed: ReadonlySet<string>,
): boolean {
  const source = requestSourceOrigin(req);
  return source !== null && allowed.has(source);
}

export function configuredHosts(env: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  return new Set(
    [...configuredOrigins(env)].map((origin) => new URL(origin).host.toLowerCase()),
  );
}
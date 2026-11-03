/** Keep provider payloads, SQL parameters, credentials and stacks out of runtime logs. */
export function safeErrorForLog(error: unknown) {
  let current = error;
  let code: string | undefined;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string" &&
        (/^[0-9]{2}[A-Z0-9]{3}$/.test(candidate.code) ||
         ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE"].includes(candidate.code))) {
      code = candidate.code;
    }
    current = candidate.cause;
  }
  return { type: "Error", message: "Internal operation failed", ...(code ? { errorCode: code } : {}) };
}

/** Use the matched route template, never raw URLs supplied by a caller. */
export function safeRequestPath(req: { baseUrl?: string; route?: { path?: unknown } }): string {
  return typeof req.route?.path === "string"
    ? `${req.baseUrl ?? ""}${req.route.path}`
    : "[unmatched route]";
}

// pino-http replaces inherited serializers, so it must receive the protected
// error serializer explicitly as well as the request/response allowlists.
export const protectedHttpSerializers = {
  req: (req: { id?: string | number; method?: string }) => ({ id: req.id, method: req.method }),
  res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  err: safeErrorForLog,
};

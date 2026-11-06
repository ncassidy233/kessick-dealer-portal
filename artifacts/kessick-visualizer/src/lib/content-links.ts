/** Only absolute web links may be rendered as external links or remote images. */
export function safeWebUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /[\s\\\u0000-\u001f\u007f]/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null;
    return trimmed;
  } catch {
    return null;
  }

}

/** CMS assets and links may also use an explicit same-origin path. */
export function safeContentUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /[\s\\\u0000-\u001f\u007f]/.test(trimmed)) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return safeWebUrl(trimmed);
}
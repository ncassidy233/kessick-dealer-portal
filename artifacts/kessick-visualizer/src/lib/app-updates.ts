export function appEntryVersion(src: string, baseUrl: string): string | null {
  try {
    const base = new URL(baseUrl);
    const entry = new URL(src, base);
    if (entry.origin !== base.origin || !entry.pathname.startsWith(`${base.pathname}assets/`)) return null;
    return /\/index-[\w-]+\.js$/.test(entry.pathname) ? entry.pathname : null;
  } catch { return null; }
}

export function publishedEntryVersion(html: string, baseUrl: string): string | null {
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (!/(?:^|\s)type\s*=\s*["']module["']/i.test(match[1])) continue;
    const src = /(?:^|\s)src\s*=\s*["']([^"']+)["']/i.exec(match[1])?.[1];
    const version = src && appEntryVersion(src, baseUrl);
    if (version) return version;
  }
  return null;
}

// Read only the public entry document; never cache private portal/API data.
export function createAppUpdateCheck({ currentVersion, baseUrl, isVisible, onUpdate,
  fetcher = fetch, now = Date.now,
}: {
  currentVersion: string;
  baseUrl: string;
  isVisible: () => boolean;
  onUpdate: () => void;
  fetcher?: typeof fetch;
  now?: () => number;
}) {
  let controller: AbortController | undefined;
  let stopped = false;
  let found = false;
  let lastCheck = -Infinity;
  return {
    async check() {
      if (stopped || found || controller || !isVisible() || now() - lastCheck < 5000) return;
      lastCheck = now();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);
      try {
        const response = await fetcher(new URL("index.html", baseUrl), {
          cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal,
          headers: { Accept: "text/html" },
        });
        if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return;
        const version = publishedEntryVersion(await response.text(), baseUrl);
        if (!stopped && version && version !== currentVersion) {
          found = true;
          onUpdate();
        }
      } catch {
        // Offline and failed checks are quiet; try again on the next resume.
      } finally {
        clearTimeout(timeout);
        controller = undefined;
      }
    },
    stop() { stopped = true; controller?.abort(); },
  };
}

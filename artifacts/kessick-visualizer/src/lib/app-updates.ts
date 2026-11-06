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

export function publishedManifestVersion(value: unknown, baseUrl: string): string | null {
  if (!value || typeof value !== "object") return null;
  const release = value as { schemaVersion?: unknown; entry?: unknown };
  return release.schemaVersion === 1 && typeof release.entry === "string"
    ? appEntryVersion(release.entry, baseUrl) : null;
}

export function appReleaseId(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export function publishedReleaseId(html: string): string | null {
  for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
    if (!/(?:^|\s)name\s*=\s*["']kessick-release["']/i.test(match[1])) continue;
    const content = /(?:^|\s)content\s*=\s*["']([^"']+)["']/i.exec(match[1])?.[1];
    const releaseId = appReleaseId(content);
    if (releaseId) return releaseId;
  }
  return null;
}

// Read only public release metadata/the entry document; never cache private data.
export function createAppUpdateCheck({ currentVersion, currentReleaseId, baseUrl, isVisible, onUpdate,
  fetcher = fetch, now = Date.now,
}: {
  currentVersion: string;
  currentReleaseId?: string | null;
  baseUrl: string;
  isVisible: () => boolean;
  onUpdate: (version: string) => void;
  fetcher?: typeof fetch;
  now?: () => number;
}) {
  const loadedReleaseId = appReleaseId(currentReleaseId);
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
        const options: RequestInit = {
          cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal,
        };
        let version: string | null = null;
        let releaseId: string | null = null;
        try {
          const manifest = await fetcher(new URL("app-version.json", baseUrl), {
            ...options, headers: { Accept: "application/json" },
          });
          if (manifest.ok && manifest.headers.get("content-type")?.includes("application/json")) {
            const release: unknown = await manifest.json();
            version = publishedManifestVersion(release, baseUrl);
            if (version) releaseId = appReleaseId((release as { releaseId?: unknown }).releaseId);
          }
        } catch {
          // Older releases have only index.html; retain the migration path.
        }
        if (!version && !controller.signal.aborted) {
          const response = await fetcher(new URL("index.html", baseUrl), {
            ...options, headers: { Accept: "text/html" },
          });
          if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return;
          const html = await response.text();
          version = publishedEntryVersion(html, baseUrl);
          if (version) releaseId = publishedReleaseId(html);
        }
        const changed = version !== currentVersion || (loadedReleaseId && releaseId && loadedReleaseId !== releaseId);
        if (!stopped && version && changed) {
          found = true;
          onUpdate(version);
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

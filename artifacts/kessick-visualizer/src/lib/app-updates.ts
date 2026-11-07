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

/** Keep the current route, filters and anchor while bypassing an old entry document. */
export function freshAppUrl(href: string, baseUrl: string, token = Date.now().toString(36)): string {
  const base = new URL(baseUrl);
  let target = new URL(href, base);
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) target = base;
  target.searchParams.set("_kessick_update", token);
  return target.href;
}

/** Wait briefly for the new worker, without making a stuck registration block Update now. */
export async function prepareAppUpdate(
  container: Pick<ServiceWorkerContainer, "register"> | undefined,
  baseUrl: string,
  timeoutMs = 3000,
): Promise<void> {
  if (!container) return;
  let stopped = false;
  let cleanup = () => {};
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const prepare = async () => {
    const registration = await container.register(new URL("sw.js", baseUrl).href, {
      scope: new URL(baseUrl).pathname, updateViaCache: "none",
    });
    if (stopped) return;
    await registration.update();
    if (stopped) return;
    const worker = registration.installing || registration.waiting;
    if (!worker || worker.state === "activated" || worker.state === "redundant") return;
    await new Promise<void>(resolve => {
      const changed = () => {
        if (worker.state !== "activated" && worker.state !== "redundant") return;
        resolve();
      };
      cleanup = () => worker.removeEventListener("statechange", changed);
      worker.addEventListener("statechange", changed);
      changed();
    });
  };
  try {
    await Promise.race([
      prepare().catch(() => {}),
      new Promise<void>(resolve => { timeout = setTimeout(resolve, timeoutMs); }),
    ]);
  } finally {
    stopped = true;
    clearTimeout(timeout);
    cleanup();
  }
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
    async check({ force = false }: { force?: boolean } = {}) {
      if (stopped || found || controller || !isVisible() || (!force && now() - lastCheck < 5000)) return;
      lastCheck = now();
      controller = new AbortController();
      const requestController = controller;
      const timeout = setTimeout(() => requestController.abort(), 10_000);
      let abort!: () => void;
      const aborted = new Promise<never>((_resolve, reject) => {
        abort = () => reject(new DOMException("Update check aborted", "AbortError"));
        requestController.signal.addEventListener("abort", abort, { once: true });
      });
      try {
        const options: RequestInit = {
          cache: "no-store", credentials: "omit", redirect: "error", signal: requestController.signal,
        };
        let version: string | null = null;
        let releaseId: string | null = null;
        try {
          const manifest = await Promise.race([fetcher(new URL("app-version.json", baseUrl), {
            ...options, headers: { Accept: "application/json" },
          }), aborted]);
          if (manifest.ok && manifest.headers.get("content-type")?.includes("application/json")) {
            const release: unknown = await Promise.race([manifest.json(), aborted]);
            version = publishedManifestVersion(release, baseUrl);
            if (version) releaseId = appReleaseId((release as { releaseId?: unknown }).releaseId);
          }
        } catch {
          // Older releases have only index.html; retain the migration path.
        }
        if (!version && !requestController.signal.aborted) {
          const response = await Promise.race([fetcher(new URL("index.html", baseUrl), {
            ...options, headers: { Accept: "text/html" },
          }), aborted]);
          if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return;
          const html = await Promise.race([response.text(), aborted]);
          version = publishedEntryVersion(html, baseUrl);
          if (version) releaseId = publishedReleaseId(html);
        }
        const changed = version !== currentVersion || (loadedReleaseId && releaseId && loadedReleaseId !== releaseId);
        if (!stopped && !requestController.signal.aborted && version && changed) {
          found = true;
          onUpdate(version);
        }
      } catch {
        // Offline and failed checks are quiet; try again on the next resume.
      } finally {
        clearTimeout(timeout);
        requestController.signal.removeEventListener("abort", abort);
        controller = undefined;
      }
    },
    stop() { stopped = true; controller?.abort(); },
  };
}

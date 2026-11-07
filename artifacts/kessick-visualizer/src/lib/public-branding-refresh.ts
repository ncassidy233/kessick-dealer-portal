const publishedEvent = "kessick:public-branding-published";
const publishedStorageKey = "kessick-public-branding-published";

/** Notify this tab and other open tabs only after a home publication succeeds. */
export function notifyPublishedPortalBranding() {
  window.dispatchEvent(new Event(publishedEvent));
  try {
    // This is an invalidation marker only. Published content is always read from the API.
    window.localStorage.setItem(publishedStorageKey, `${Date.now()}-${Math.random()}`);
  } catch { /* Refresh on return and periodic refresh also work without local storage. */ }
}

/** Keep public presentation current without touching an active editor's draft. */
export function installPublishedBrandingRefresh<T>({
  windowTarget,
  documentTarget,
  isVisible,
  read,
  onValue,
  pollIntervalMs = 30_000,
  requestTimeoutMs = 10_000,
}: {
  windowTarget: EventTarget;
  documentTarget: EventTarget;
  isVisible: () => boolean;
  read: (signal: AbortSignal) => Promise<T | undefined>;
  onValue: (value: T) => void;
  pollIntervalMs?: number;
  requestTimeoutMs?: number;
}) {
  let active = true;
  let pending: { controller: AbortController; timeout: ReturnType<typeof setTimeout> } | undefined;
  const cancel = () => {
    if (!pending) return;
    clearTimeout(pending.timeout);
    pending.controller.abort();
    pending = undefined;
  };
  const refresh = (replacePending = false) => {
    if (!active || !isVisible()) return;
    if (pending && !replacePending) return;
    cancel();
    const controller = new AbortController();
    const request = {
      controller,
      timeout: setTimeout(() => {
        controller.abort();
        if (pending === request) pending = undefined;
      }, requestTimeoutMs),
    };
    pending = request;
    void Promise.resolve().then(() => controller.signal.aborted ? undefined : read(controller.signal)).then(value => {
      if (active && pending === request && !controller.signal.aborted && value !== undefined) onValue(value);
    }).catch(() => {
      // Keep the last published presentation during an outage; a later read can recover.
    }).finally(() => {
      clearTimeout(request.timeout);
      if (pending === request) pending = undefined;
    });
  };
  const onResume = () => { refresh(true); };
  const onVisibility = () => {
    if (isVisible()) onResume();
    else cancel();
  };
  const onStorage = (event: Event) => {
    if ((event as StorageEvent).key === publishedStorageKey) onResume();
  };
  const events = ["pageshow", "focus", "online", publishedEvent];
  for (const event of events) windowTarget.addEventListener(event, onResume);
  windowTarget.addEventListener("storage", onStorage);
  documentTarget.addEventListener("visibilitychange", onVisibility);
  const interval = setInterval(() => refresh(), pollIntervalMs);
  refresh();
  return () => {
    active = false;
    cancel();
    clearInterval(interval);
    for (const event of events) windowTarget.removeEventListener(event, onResume);
    windowTarget.removeEventListener("storage", onStorage);
    documentTarget.removeEventListener("visibilitychange", onVisibility);
  };
}

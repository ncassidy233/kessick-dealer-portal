// Retry reads briefly while a mobile connection or session cookie recovers.
// Permission denials (403) and other client errors must remain terminal.
export function retryAccessRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const status = (error as { status?: number } | null)?.status;
  return error instanceof TypeError || status === 401 || status === 408
    || status === 429 || (typeof status === "number" && status >= 500);
}

export const accessRetryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 2000);

// Clerk refreshes can stall when a laptop wakes with a broken connection.
// Share one attempt across focus events and access reads, but always release
// callers so the server can report a real expired or unavailable session.
export function createSessionRecovery(
  refreshSession: () => Promise<unknown>,
  timeoutMs = 5_000,
): () => Promise<boolean> {
  let pending: Promise<boolean> | undefined;
  return () => {
    if (pending) return pending;
    pending = new Promise<boolean>(resolve => {
      let settled = false;
      const finish = (refreshed: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(refreshed);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      Promise.resolve().then(refreshSession).then(
        token => finish(Boolean(token)),
        () => finish(false),
      );
    }).finally(() => { pending = undefined; });
    return pending;
  };
}

export function installSessionFocusRecovery({
  windowTarget, documentTarget, isVisible, refreshSession, onFocus, timeoutMs,
}: {
  windowTarget: EventTarget;
  documentTarget: EventTarget;
  isVisible: () => boolean;
  refreshSession: () => Promise<unknown>;
  onFocus: (focused: boolean) => void;
  timeoutMs?: number;
}) {
  let active = true;
  let pending: Promise<void> | undefined;
  const recover = createSessionRecovery(refreshSession, timeoutMs);

  const resume = () => {
    if (!isVisible()) {
      onFocus(false);
      return;
    }
    if (pending) return;
    // Refresh Clerk's cookie before Query refetches account/permission reads.
    onFocus(false);
    pending = recover().then(() => {
      // Even an expired or unreachable session must reach normal server checks.
      if (active && isVisible()) onFocus(true);
    }).finally(() => { pending = undefined; });
  };

  documentTarget.addEventListener("visibilitychange", resume);
  windowTarget.addEventListener("pageshow", resume);
  windowTarget.addEventListener("focus", resume);
  windowTarget.addEventListener("online", resume);
  if (!isVisible()) onFocus(false);
  return () => {
    active = false;
    documentTarget.removeEventListener("visibilitychange", resume);
    windowTarget.removeEventListener("pageshow", resume);
    windowTarget.removeEventListener("focus", resume);
    windowTarget.removeEventListener("online", resume);
  };
}

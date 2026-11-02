// Retry reads briefly while a mobile connection or session cookie recovers.
// Permission denials (403) and other client errors must remain terminal.
export function retryAccessRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const status = (error as { status?: number } | null)?.status;
  return error instanceof TypeError || status === 401 || status === 408
    || status === 429 || (typeof status === "number" && status >= 500);
}

export const accessRetryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 2000);

export function installSessionFocusRecovery({
  windowTarget, documentTarget, isVisible, refreshSession, onFocus,
}: {
  windowTarget: EventTarget;
  documentTarget: EventTarget;
  isVisible: () => boolean;
  refreshSession: () => Promise<unknown>;
  onFocus: (focused: boolean) => void;
}) {
  let active = true;
  let pending: Promise<void> | undefined;

  const resume = () => {
    if (!isVisible()) {
      onFocus(false);
      return;
    }
    if (pending) return;
    // Refresh Clerk's cookie before Query refetches account/permission reads.
    onFocus(false);
    pending = Promise.resolve().then(refreshSession).catch(() => {
      // Let the normal server checks and bounded retries report a real failure.
    }).then(() => {
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

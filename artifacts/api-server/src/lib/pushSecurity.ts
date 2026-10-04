import webPush from "web-push";

export const PUSH_SEND_TIMEOUT_MS = 10_000;
export const PUSH_MAX_CONCURRENCY = 8;
export const PUSH_MAX_SUBSCRIPTIONS_PER_ACCOUNT = 10;
export const PUSH_MAX_SUBSCRIPTIONS_PER_DISPATCH = 5_000;

const exactHosts = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);

function isAllowedWindowsPushHost(hostname: string): boolean {
  return hostname === "notify.windows.com" || hostname.endsWith(".notify.windows.com");
}

export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || (url.port && url.port !== "443")
      || !url.pathname
      || url.pathname === "/"
    ) return false;
    const hostname = url.hostname.toLowerCase();
    return exactHosts.has(hostname) || isAllowedWindowsPushHost(hostname);
  } catch {
    return false;
  }
}

export type PushConfiguration = {
  configured: boolean;
  publicKey: string | null;
  error: string | null;
};

let configuredFor: string | null = null;

export function configurePushFromEnvironment(): PushConfiguration {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  if (!publicKey || !privateKey) {
    return {
      configured: false,
      publicKey: null,
      error: "Push delivery is not configured. Set both VAPID key environment variables.",
    };
  }
  try {
    if (configuredFor !== publicKey) {
      webPush.setVapidDetails(
        process.env.VAPID_SUBJECT?.trim() || "https://kessick.com",
        publicKey,
        privateKey,
      );
      configuredFor = publicKey;
    }
    return { configured: true, publicKey, error: null };
  } catch {
    return {
      configured: false,
      publicKey: null,
      error: "Push delivery is disabled because the VAPID configuration is invalid.",
    };
  }
}

export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      for (;;) {
        const index = cursor++;
        if (index >= values.length) return;
        results[index] = await task(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

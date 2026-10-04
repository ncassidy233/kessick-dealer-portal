import assert from "node:assert/strict";
import test from "node:test";
import { configurePushFromEnvironment, isAllowedPushEndpoint, mapWithConcurrency } from "./pushSecurity";

test("push endpoints are restricted to known HTTPS providers", () => {
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc"), true);
  assert.equal(isAllowedPushEndpoint("https://db5.notify.windows.com/w/?token=abc"), true);
  assert.equal(isAllowedPushEndpoint("https://web.push.apple.com/QWERTY"), true);
  assert.equal(isAllowedPushEndpoint("https://127.0.0.1/push"), false);
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/fcm/send/abc"), false);
  assert.equal(isAllowedPushEndpoint("https://user:pass@fcm.googleapis.com/fcm/send/abc"), false);
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.test/fcm/send/abc"), false);
  assert.equal(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"), false);
});

test("concurrency mapper never exceeds its limit", async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return value * 2;
  });
  assert.deepEqual(results, [2, 4, 6, 8, 10]);
  assert.equal(peak, 2);
});

test("invalid VAPID configuration fails closed without exposing key material", () => {
  const previousPublic = process.env.VAPID_PUBLIC_KEY;
  const previousPrivate = process.env.VAPID_PRIVATE_KEY;
  process.env.VAPID_PUBLIC_KEY = "invalid-public-value";
  process.env.VAPID_PRIVATE_KEY = "invalid-private-value";
  try {
    const configuration = configurePushFromEnvironment();
    assert.equal(configuration.configured, false);
    assert.equal(configuration.publicKey, null);
    assert.match(configuration.error ?? "", /invalid/i);
    assert.doesNotMatch(configuration.error ?? "", /invalid-(?:public|private)-value/);
  } finally {
    if (previousPublic === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = previousPublic;
    if (previousPrivate === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = previousPrivate;
  }
});

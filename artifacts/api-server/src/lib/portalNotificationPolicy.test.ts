import test from "node:test";
import assert from "node:assert/strict";
import { canClaimPush, isDealerNotificationVisible, isNotificationDue, notificationCanBeEdited, shouldListDealerNotification } from "./portalNotificationPolicy";

const now = new Date("2025-01-01T12:00:00.000Z");

test("scheduler only claims due scheduled notifications", () => {
  assert.equal(isNotificationDue("draft", new Date("2024-01-01T00:00:00.000Z"), now), false);
  assert.equal(isNotificationDue("scheduled", new Date("2025-01-01T12:00:00.000Z"), now), true);
  assert.equal(isNotificationDue("scheduled", new Date("2025-01-01T12:00:01.000Z"), now), false);
});

test("required acknowledgements bypass only in-app listing preference", () => {
  assert.equal(shouldListDealerNotification(true, false, true), true);
  assert.equal(shouldListDealerNotification(true, false, false), false);
});

test("a stale push claim is retried while a live claim remains exclusive", () => {
  assert.equal(canClaimPush("sending", new Date("2025-01-01T11:54:59.000Z"), null, 1, now), true);
  assert.equal(canClaimPush("sending", new Date("2025-01-01T11:57:01.000Z"), null, 1, now), false);
  assert.equal(canClaimPush("failed", null, new Date("2025-01-01T12:01:00.000Z"), 1, now), false);
  assert.equal(canClaimPush("failed", null, new Date("2025-01-01T11:59:00.000Z"), 1, now), true);
  assert.equal(canClaimPush("failed", null, null, 5, now), false);
});

test("drafts remain editable and expired sends are hidden from dealers", () => {
  assert.equal(notificationCanBeEdited("draft"), true);
  assert.equal(notificationCanBeEdited("sent"), false);
  assert.equal(isDealerNotificationVisible("sent", new Date("2025-01-01T11:59:59.000Z"), now), false);
  assert.equal(isDealerNotificationVisible("sent", new Date("2025-01-01T12:00:01.000Z"), now), true);
});
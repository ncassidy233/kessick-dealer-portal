import assert from "node:assert/strict";
import test from "node:test";
import { portalRelativeTime } from "./portal-dates";

test("trimmed or invalid timestamps render without crashing dealer pages", () => {
  for (const value of [undefined, null, "", "invalid"]) assert.equal(portalRelativeTime(value), null);
  assert.equal(typeof portalRelativeTime(new Date().toISOString()), "string");
});

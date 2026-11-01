import assert from "node:assert/strict";
import test from "node:test";
import { activePromotion, promotionSchema } from "@workspace/api-zod";
const offer = { percentOff: 15, startsAt: "2026-11-01T12:00:00Z", endsAt: "2026-11-02T12:00:00Z", collections: ["Estate"], terms: "Quote approval required" };
test("offers start inclusively and expire exclusively across timezone offsets", () => {
  assert.equal(activePromotion(offer, new Date("2026-11-01T11:59:59Z")), null);
  assert.ok(activePromotion(offer, new Date("2026-11-01T07:00:00-05:00")));
  assert.equal(activePromotion(offer, new Date(offer.endsAt)), null);
});
test("invalid discount amounts, dates, scope, caps and missing terms cannot publish", () => {
  for (const patch of [{ percentOff: 101 }, { percentOff: 0 }, { endsAt: offer.startsAt }, { startsAt: "tomorrow" }, { collections: [] }, { terms: " " }, { minimumOrder: -1 }, { maximumSavings: 0 }]) assert.equal(promotionSchema.safeParse({ ...offer, ...patch }).success, false);
  const parsed = promotionSchema.parse(offer);
  assert.equal(parsed.combinable, false);
  assert.equal(parsed.minimumOrder, 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import { isMappedLegacyItemVisible, isPortalTargetVisible, legacyPageCapabilityForContent, linkedResourceId, shouldDisableLinkedLegacyContent } from "./portalTargetPolicy";

test("content targets grant a dealer through any of multiple groups", () => {
  const targets = [{ groupId: "north", accountId: null }, { groupId: "west", accountId: null }];
  assert.equal(isPortalTargetVisible("groups", targets, "dealer-1", ["south", "west"]), true);
  assert.equal(isPortalTargetVisible("groups", targets, "dealer-1", ["south"]), false);
});

test("v2 legacy-linked content retains the old page-level access boundary", () => {
  assert.equal(legacyPageCapabilityForContent("form"), "page:forms");
  assert.equal(legacyPageCapabilityForContent("resource"), "page:resources");
  assert.equal(legacyPageCapabilityForContent("price_book"), "page:pricing");
});

test("deleting linked content keeps legacy forms, resources, and price books disabled", () => {
  assert.equal(shouldDisableLinkedLegacyContent("price_book"), true);
  assert.equal(shouldDisableLinkedLegacyContent("form"), true);
  assert.equal(shouldDisableLinkedLegacyContent("resource"), true);
  assert.equal(shouldDisableLinkedLegacyContent("announcement"), false);
});

test("an unpublished legacy mapping denies rather than reopening the old item", () => {
  assert.equal(isMappedLegacyItemVisible([{ published: false, visibility: "everyone", targets: [] }], "dealer-1", []), false);
  assert.equal(isMappedLegacyItemVisible([], "dealer-1", []), true);
});

test("individual targets do not leak content through a group", () => {
  assert.equal(isPortalTargetVisible("individuals", [{ groupId: "north", accountId: "dealer-2" }], "dealer-1", ["north"]), false);
  assert.equal(isPortalTargetVisible("individuals", [{ groupId: null, accountId: "dealer-1" }], "dealer-1", []), true);
});

test("only resource content with a valid legacy UUID can enable a linked resource", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(linkedResourceId("resource", { legacyId: id }), id);
  assert.equal(linkedResourceId("training", { legacyId: id }), null);
  assert.equal(linkedResourceId("resource", { legacyId: "not-a-uuid" }), null);
  assert.equal(linkedResourceId("resource", {}), null);
  assert.equal(linkedResourceId("resource", null), null);
  // A committed group mapping is deny-by-default to anyone outside the group;
  // failed v2 saves leave the initially disabled uploaded legacy resource hidden.
  assert.equal(isMappedLegacyItemVisible([{ published: true, visibility: "groups", targets: [{ groupId: "staff", accountId: null }] }], "dealer", []), false);
});
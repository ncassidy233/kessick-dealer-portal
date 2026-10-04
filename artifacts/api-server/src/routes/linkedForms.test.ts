import assert from "node:assert/strict";
import test from "node:test";
import { linkedFormInput } from "./linkedForms";
import { hasPortalCapability } from "../lib/portalPermissions";
import { isMappedLegacyItemVisible } from "../lib/portalTargetPolicy";

const groupId = "00000000-0000-4000-8000-000000000001";
const accountId = "00000000-0000-4000-8000-000000000002";
const input = {
  title: "Contact",
  description: null,
  fieldDefinitions: [{ name: "email", label: "Email", type: "email", required: true }],
  published: true,
  visibility: "groups",
  groupIds: [groupId],
  accountIds: [],
};

test("linked form writes use the same content:write permission as v2 content", () => {
  for (const role of ["super_admin", "staff_admin", "sales_rep", "content_manager"] as const) {
    assert.equal(hasPortalCapability(role, "content:write"), role !== "sales_rep");
  }
});

test("linked forms require valid exclusive audience targeting and reject duplicates", () => {
  assert.equal(linkedFormInput.safeParse(input).success, true);
  assert.equal(linkedFormInput.safeParse({ ...input, groupIds: [] }).success, false);
  assert.equal(linkedFormInput.safeParse({ ...input, accountIds: [accountId] }).success, false);
  assert.equal(linkedFormInput.safeParse({ ...input, visibility: "everyone" }).success, false);
  assert.equal(linkedFormInput.safeParse({ ...input, groupIds: [groupId, groupId] }).success, false);
  assert.equal(linkedFormInput.safeParse({ ...input, fieldDefinitions: [input.fieldDefinitions[0], input.fieldDefinitions[0]] }).success, false);
  assert.equal(linkedFormInput.safeParse({ ...input, fieldDefinitions: [{ name: "pick", label: "Pick", type: "select", required: true }] }).success, false);
  assert.equal(linkedFormInput.safeParse({ ...input, legacyId: accountId }).success, false);
});

test("a mapped form cannot fall back to legacy everyone visibility", () => {
  const mapping = [{ published: true, visibility: "groups" as const, targets: [{ groupId, accountId: null }] }];
  assert.equal(isMappedLegacyItemVisible(mapping, accountId, []), false);
  assert.equal(isMappedLegacyItemVisible(mapping, accountId, [groupId]), true);
  assert.equal(isMappedLegacyItemVisible([{ ...mapping[0], published: false }], accountId, [groupId]), false);
});
import assert from "node:assert/strict";
import test from "node:test";
import {
  canRebaseConfirmedProjectRename,
  reconcileConfirmedProjectName,
  reconcileConfirmedProjectVersion,
} from "./project-reconciliation";

test("applies a confirmed rename to an editor still using the previous cloud name", () => {
  assert.equal(
    reconcileConfirmedProjectName(
      "Initial Project",
      "Initial Project",
      "Confirmed Project",
    ),
    "Confirmed Project",
  );
});

test("preserves a newer local name edit while advancing the cloud version", () => {
  assert.equal(
    reconcileConfirmedProjectName(
      "Unsaved Local Name",
      "Initial Project",
      "Confirmed Project",
    ),
    "Unsaved Local Name",
  );
  assert.equal(reconcileConfirmedProjectVersion(4, 5), 5);
});

test("rejects a rename rebase when the editor has not acknowledged the action version", () => {
  assert.equal(canRebaseConfirmedProjectRename(5, 6), false);
  assert.equal(canRebaseConfirmedProjectRename(6, 6), true);
});
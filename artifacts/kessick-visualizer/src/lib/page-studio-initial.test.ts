import assert from "node:assert/strict";
import test from "node:test";
import { initialStudioPage, studioEditingDocument } from "./page-studio";

test("a first login-only publication preserves the built-in dealer dashboard", () => {
  const login = studioEditingDocument("home", { draft: null }, true);
  assert.deepEqual(login.sections, []);
  assert.equal(initialStudioPage("home").sections.length, 1);
});

test("login editing preserves a saved Home draft or published Home design without replacing sections", () => {
  const publishedDocument = initialStudioPage("home");
  publishedDocument.sections[0].heading = "Existing published home";
  const original = JSON.stringify(publishedDocument);
  const initial = studioEditingDocument("home", { draft: null, publishedDocument }, true);
  assert.deepEqual(initial, publishedDocument);
  assert.equal(JSON.stringify(publishedDocument), original);
  const draft = { document: { ...publishedDocument, title: "Current private draft" }, revision: 4, updatedAt: "2026-11-05T00:00:00Z", updatedByAccountId: "test-editor" };
  assert.deepEqual(studioEditingDocument("home", { draft, publishedDocument }, true), draft.document);
  assert.equal(draft.revision, 4);
});

import assert from "node:assert/strict";
import test from "node:test";
import { formFieldsError } from "./form-fields.ts";

test("allows supported builder fields, including textarea and selected choices", () => {
  assert.equal(formFieldsError([
    { name: "notes", label: "Notes", type: "textarea" },
    { name: "finish", label: "Finish", type: "select", options: ["Oak", "Walnut"] },
  ]), null);
});

test("blocks malformed keys, duplicate names and empty select choices", () => {
  assert.match(formFieldsError([{ name: "1bad", label: "Label", type: "text" }])!, /key/);
  assert.match(formFieldsError([
    { name: "name", label: "First", type: "text" },
    { name: "name", label: "Second", type: "text" },
  ])!, /unique/);
  assert.match(formFieldsError([{ name: "choice", label: "Choice", type: "select", options: ["Oak", ""] }])!, /nonempty/);
  assert.match(formFieldsError([{ name: "choice", label: "Choice", type: "select", options: [] }])!, /nonempty/);
});
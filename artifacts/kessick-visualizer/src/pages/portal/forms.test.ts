import assert from "node:assert/strict";
import test from "node:test";
import { definitionError, submissionValues, validateField } from "./forms";

test("validates required fields and each staff-supported field type", () => {
  assert.equal(validateField({ type: "text", required: true }, "   "), "This field is required.");
  assert.equal(validateField({ type: "textarea", required: true }, "\n  "), "This field is required.");
  assert.equal(validateField({ type: "text", required: false }, ""), true);
  assert.equal(validateField({ type: "email" }, "not-an-email"), "Enter a valid email address.");
  assert.equal(validateField({ type: "email" }, "dealer@example.com"), true);
  assert.equal(validateField({ type: "number" }, "Infinity"), "Enter a valid number.");
  assert.equal(validateField({ type: "number" }, "12.5"), true);
  assert.equal(validateField({ type: "date" }, "2025-02-30"), "Enter a valid date.");
  assert.equal(validateField({ type: "date" }, "2024-02-29"), true);
  assert.equal(validateField({ type: "select", options: ["Walnut", "Oak"] }, "Pine"), "Choose one of the available options.");
  assert.equal(validateField({ type: "select", options: ["Walnut", "Oak"] }, "Oak"), true);
});

test("blocks invalid definitions instead of submitting mismatched answers", () => {
  assert.match(definitionError([{ name: "finish", label: "Finish", type: "select", options: [] }])!, /no choices/);
  assert.match(definitionError([{ name: "finish", label: "Finish", type: "text" }, { name: "finish", label: "Another", type: "text" }])!, /duplicate/);
  assert.match(definitionError([{ name: "finish", label: "Finish", type: "unsupported" }])!, /unsupported/);
  assert.equal(definitionError([{ name: "finish", label: "Finish", type: "select", options: ["Oak"] }]), null);
});

test("submits named answers, numeric values, and skips blank optional answers", () => {
  const fields = [
    { name: "quantity", type: "number", label: "Quantity" },
    { name: "finish", type: "select", label: "Finish", options: ["Walnut", "Oak"] },
    { name: "notes", type: "textarea", label: "Notes" },
    { name: "optional", type: "text", label: "Optional" },
    { label: "Fallback", type: "date" },
  ];
  const result = submissionValues(fields, { fields: [" 2.5 ", "Oak", "  Keep spacing  ", "   ", "2025-06-01"] });
  assert.deepEqual({ ...result }, {
    quantity: 2.5, finish: "Oak", notes: "  Keep spacing  ", field_5: "2025-06-01",
  });
});
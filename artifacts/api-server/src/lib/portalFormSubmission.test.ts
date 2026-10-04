import assert from "node:assert/strict";
import test from "node:test";
import { validatePortalFormSubmission as validate } from "./portalFormSubmission";
import { db, portalFormSubmissionsTable } from "@workspace/db";

const fields = [
  { name: "contact", label: "Contact", type: "email", required: true },
  { name: "amount", label: "Amount", type: "number", required: true },
  { name: "when", label: "Date", type: "date", required: true },
  { name: "finish", label: "Finish", type: "select", required: true, options: ["Oak", "Walnut"] },
  { name: "summary", label: "Summary", type: "text", required: false },
  { name: "details", label: "Details", type: "textarea", required: true },
];
const values = {
  contact: " dealer@example.com ", amount: 2.5, when: "2024-02-29",
  finish: "Oak", details: "  Long answer\n" + "a".repeat(5000),
};

test("accepts typed answers and preserves long textarea content", () => {
  const result = validate(fields, values);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.values.contact, "dealer@example.com");
    assert.equal(result.values.amount, 2.5);
    assert.equal(result.values.details, values.details);
    assert.equal("summary" in result.values, false);
  }
  assert.equal(validate([{ label: "Legacy", type: "text", required: true }], { field_1: "hello" }).ok, true);
});

test("validated JSONB answers compile through the actual Drizzle insert builder", () => {
  const validated = validate(fields, values);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  // The validator intentionally returns a null-prototype map; Drizzle's
  // entity detector cannot accept that map directly as a JSONB value.
  const jsonbValue = { ...validated.values };
  assert.equal(Object.getPrototypeOf(jsonbValue), Object.prototype);
  const query = db.insert(portalFormSubmissionsTable).values({
    formId: "00000000-0000-4000-8000-000000000001",
    accountId: "00000000-0000-4000-8000-000000000002",
    values: jsonbValue,
  }).toSQL();
  assert.match(query.sql, /insert into "portal_form_submissions"/);
  assert.ok(query.params.some((param) => typeof param === "string" &&
    param.includes('"contact":"dealer@example.com"') &&
    param.includes('"amount":2.5')));
});

test("rejects forged, missing, mismatched and invalid direct submissions", () => {
  const invalid = [
    { ...values, admin: true },
    { ...values, contact: " " },
    { ...values, contact: "not-an-email" },
    { ...values, amount: "2.5" },
    { ...values, amount: null },
    { ...values, when: "2025-02-30" },
    { ...values, finish: "Cherry" },
    { ...values, details: { html: "<b>hi</b>" } },
    { ...values, details: " " },
    { ...values, summary: "x".repeat(2001) },
  ];
  for (const attempt of invalid) assert.equal(validate(fields, attempt).ok, false);
  assert.equal(validate(fields, ["not", "an", "object"]).ok, false);
});

test("rejects malformed stored definitions instead of trusting them", () => {
  const invalid = [
    [{ name: "x", label: "X", type: "unknown" }],
    [{ name: "x", label: "X", type: "text" }, { name: "x", label: "X", type: "text" }],
    [{ name: "x", label: "X", type: "select", options: [] }],
  ];
  for (const definition of invalid) {
    const result = validate(definition, { x: "a" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.invalidDefinition, true);
  }
});
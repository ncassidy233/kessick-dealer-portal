import assert from "node:assert/strict";
import test from "node:test";
import { escapeCsvCell, toCsvString } from "./csv-safety";

test("neutralizes spreadsheet formulas in string cells", () => {
  for (const value of [
    "=1+1",
    "+cmd|' /C calc'!A0",
    "-2+3",
    "@SUM(A1:A2)",
    " \t=HYPERLINK(\"https://example.invalid\")",
  ]) {
    assert.equal(escapeCsvCell(value).replace(/^"|"$/g, ""), `'${value}`.replace(/"/g, '""'));
  }
});

test("preserves numeric fields without converting them to text", () => {
  assert.equal(toCsvString([[42, -7, 3.5, "42", "-7"]]), "42,-7,3.5,42,'-7");
});

test("retains standard CSV quoting and escaping", () => {
  assert.equal(escapeCsvCell('hello, "world"'), '"hello, ""world"""');
  assert.equal(escapeCsvCell("line one\nline two"), '"line one\nline two"');
  assert.equal(escapeCsvCell(null), "");
});
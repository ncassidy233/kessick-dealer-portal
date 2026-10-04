import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { canActivateKnowledge, knowledgeEligible, knowledgeTerms, knowledgeSnippets, csvCell, insightDates } from "./knowledgePolicy";
import { extractKnowledge } from "./knowledgeExtraction";
import { csrfGuard } from "../security/csrf";
import { filterAuthorizedCitations } from "./conciergeSafety";
import { isMissingKnowledgeSchema, knowledgeSchemaOperation, KnowledgeUnavailableError } from "./knowledgeAvailability";

test("knowledge lifecycle and audience fail closed", () => {
  for (const status of ["review", "archived", "error"]) {
    assert.equal(knowledgeEligible({ status, audience: "staff" }, "staff"), false);
  }
  assert.equal(knowledgeEligible({ status: "active", audience: "staff" }, null), false);
  assert.equal(knowledgeEligible({ status: "active", audience: "staff" }, "approved_dealers"), false);
  assert.equal(knowledgeEligible({ status: "active", audience: "approved_dealers" }, "approved_dealers"), true);
  assert.equal(knowledgeEligible({ status: "active", audience: "staff" }, "staff"), true);
  assert.equal(knowledgeEligible({ status: "active", audience: "staff", deletedAt: new Date() }, "staff"), false);
});
test("missing knowledge migration is explicit; unrelated DB errors are not hidden", async () => {
  assert.equal(isMissingKnowledgeSchema({ cause: { code: "42P01" } }), true);
  assert.equal(isMissingKnowledgeSchema({ cause: { code: "42703" } }), true);
  assert.equal(isMissingKnowledgeSchema({ code: "ECONNREFUSED" }), false);
  await assert.rejects(knowledgeSchemaOperation(async () => { throw { cause: { code: "42P01" } }; }), KnowledgeUnavailableError);
  const failure = new Error("Connection unavailable");
  await assert.rejects(knowledgeSchemaOperation(async () => { throw failure; }), error => error === failure);
  assert.equal(await knowledgeSchemaOperation(async () => "available"), "available");
});
test("lexical snippets are bounded and irrelevant text does not enter grounding", () => {
  assert.equal(knowledgeTerms("what is this?").length, 0);
  assert.ok(knowledgeTerms(Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ")).length <= 12);
  assert.deepEqual(knowledgeSnippets("unrelated text", ["cabinet"]), []);
  const snippets = knowledgeSnippets("cabinet ".repeat(10000), ["cabinet"]);
  assert.equal(snippets.length, 2);
  assert.ok(snippets.every(text => text.length <= 1200));
  assert.deepEqual(filterAuthorizedCitations([{ sourceId: "knowledge:private:0", quote: "secret" }], new Map()), []);
});
test("activation requires explicit review and successful nonempty extraction", () => {
  const reviewed = { status: "review", extractedText: "Reviewed text", errorMessage: null };
  assert.equal(canActivateKnowledge(reviewed), true);
  for (const status of ["active", "archived", "error"]) assert.equal(canActivateKnowledge({ ...reviewed, status }), false);
  assert.equal(canActivateKnowledge({ ...reviewed, extractedText: "  " }), false);
  assert.equal(canActivateKnowledge({ ...reviewed, errorMessage: "OCR unsupported" }), false);
  assert.equal(canActivateKnowledge({ ...reviewed, deletedAt: new Date() }), false);
});
test("exports escape formulas and quotes; dates are valid inclusive UTC days", () => {
  for (const value of ["=HYPERLINK(\"x\")", "+SUM(A1)", "-1", "@cmd", " \t=1"]) assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell('a"b'), '"a""b"');
  const range = insightDates("2026-01-01", "2026-01-01");
  assert.equal(range.end.getTime() - range.start.getTime(), 86400000);
  assert.throws(() => insightDates("2026-02-30", "2026-03-01"));
  assert.throws(() => insightDates("2024-01-01", "2026-01-01"));
  assert.throws(() => insightDates("2026-03-01", "2026-01-01"));
});
test("raw knowledge PUT requires same origin and CSRF marker", () => {
  const guard = csrfGuard(new Set(["https://portal.example.com"]));
  const path = "/staff/concierge/knowledge/uploads/123e4567-e89b-42d3-a456-426614174000";
  function run(marker: string | undefined, origin: string) {
    let status = 200, next = false;
    const headers: Record<string, string | undefined> = { "content-type": "text/plain", origin, "x-kessick-csrf": marker, "sec-fetch-site": "same-origin" };
    const req = { method: "PUT", path, get: (name: string) => headers[name], is: () => false } as unknown as Request;
    const res = { status: (n: number) => { status = n; return res; }, json: () => undefined } as unknown as Response;
    guard(req, res, () => { next = true; });
    return { status, next };
  }
  assert.equal(run(undefined, "https://portal.example.com").next, false);
  assert.equal(run("1", "https://evil.example.com").next, false);
  assert.equal(run("1", "https://portal.example.com").next, true);
});
test("TXT extraction reports malformed, empty, and oversized text", async () => {
  assert.equal(await extractKnowledge(Buffer.from("Approved content"), "text/plain"), "Approved content");
  await assert.rejects(extractKnowledge(Buffer.from([0xff]), "text/plain"), /UTF-8/);
  await assert.rejects(extractKnowledge(Buffer.from("   "), "text/plain"), /no searchable/);
  await assert.rejects(extractKnowledge(Buffer.from("x".repeat(200001)), "text/plain"), /200,000/);
});
test("PDF worker extracts text and rejects active and scanned PDFs", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText("Approved cabinet care instructions", { font });
  assert.match(await extractKnowledge(Buffer.from(await pdf.save()), "application/pdf"), /Approved cabinet care instructions/);
  const scanned = await PDFDocument.create(); scanned.addPage();
  await assert.rejects(extractKnowledge(Buffer.from(await scanned.save()), "application/pdf"), /OCR/);
  pdf.catalog.set(PDFName.of("OpenAction"), pdf.context.obj({ S: "JavaScript", JS: "alert(1)" }));
  await assert.rejects(extractKnowledge(Buffer.from(await pdf.save()), "application/pdf"), /PDF rejected/);
});
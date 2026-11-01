import assert from "node:assert/strict";
import test from "node:test";
import { studioPageDocumentSchema, studioPageKeySchema, studioDraftInputSchema } from "@workspace/api-zod";

const section = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "hero", heading: "Dealer portal", description: "Published dealer information",
  background: "dark", spacing: "comfortable", alignment: "left",
  actions: [{ label: "Resources", href: "/portal/resources" }],
};
const document = { schemaVersion: 1, title: "Home", sections: [section] };

test("Page Studio accepts approved typed blocks and bounded image presentation", () => {
  assert.equal(studioPageDocumentSchema.safeParse(document).success, true);
  assert.equal(studioPageDocumentSchema.safeParse({ ...document, sections: [{ ...section, image: { url: "https://kessickwinecellars.com/example.jpg", alt: "Wine storage", fit: "cover", focalPoint: { x: 25, y: 75 } } }] }).success, true);
  assert.equal(studioDraftInputSchema.safeParse({ expectedRevision: 0, document }).success, true);
});

test("Page Studio rejects executable fields, unsafe links, malformed sections, and protected page keys", () => {
  for (const bad of [
    { ...document, html: "<script>alert(1)</script>" },
    { ...document, sections: [{ ...section, type: "raw_html" }] },
    { ...document, sections: [{ ...section, onClick: "alert(1)" }] },
    { ...document, sections: [{ ...section, actions: [{ label: "Unsafe", href: "javascript:alert(1)" }] }] },
    { ...document, sections: [{ ...section, actions: [{ label: "Staff", href: "/admin/users" }] }] },
    { ...document, sections: [{ ...section, image: { url: "data:image/svg+xml,<svg/>", alt: "x", fit: "cover", focalPoint: { x: 101, y: 50 } } }] },
    { ...document, sections: [section, section] },
    { ...document, sections: Array.from({ length: 41 }, () => section) },
  ]) assert.equal(studioPageDocumentSchema.safeParse(bad).success, false);
  for (const key of ["account", "pricing", "security", "login", "admin"]) assert.equal(studioPageKeySchema.safeParse(key).success, false);
  for (const expectedRevision of [-1, 0.5, "1"]) assert.equal(studioDraftInputSchema.safeParse({ expectedRevision, document }).success, false);
});

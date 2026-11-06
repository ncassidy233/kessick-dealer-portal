import assert from "node:assert/strict";
import test from "node:test";
import { defaultPortalPublicBranding, portalPublicBrandingSchema, publicPortalBranding, studioPageDocumentSchema } from "@workspace/api-zod";

test("public branding accepts bounded plain text and HTTPS artwork while keeping original page documents compatible", () => {
  const document = { schemaVersion: 1, title: "Dealer home", sections: [] };
  assert.equal(studioPageDocumentSchema.safeParse(document).success, true);
  assert.equal(studioPageDocumentSchema.safeParse({ ...document, publicBranding: defaultPortalPublicBranding }).success, true);
  assert.equal(portalPublicBrandingSchema.safeParse({ ...defaultPortalPublicBranding, logoUrl: "https://kessickwinecellars.com/logo.png" }).success, true);
  assert.deepEqual(publicPortalBranding(defaultPortalPublicBranding), defaultPortalPublicBranding);
  for (const faviconUrl of ["https://kessickwinecellars.com/favicon.png", ""]) {
    const branding = { ...defaultPortalPublicBranding, faviconUrl };
    assert.deepEqual(publicPortalBranding(branding), branding);
    assert.equal(studioPageDocumentSchema.safeParse({ ...document, publicBranding: branding }).success, true);
  }
});

test("public branding rejects authentication options, dealer data, executable fields, and unsafe image links", () => {
  for (const extra of [{ role: "super_admin" }, { redirectUrl: "/admin" }, { html: "<script>alert(1)</script>" }, { sections: [] }, { draft: {} }, { actorAccountId: "private" }]) {
    assert.equal(publicPortalBranding({ ...defaultPortalPublicBranding, ...extra }), null);
  }
  for (const imageUrl of ["javascript:alert(1)", "data:image/svg+xml,<svg/>", "http://example.com/image.jpg", "/api/portal-v2/admin/pages/home/draft", "//example.com/image.jpg", "https://user:password@example.com/image.jpg"]) {
    assert.equal(publicPortalBranding({ ...defaultPortalPublicBranding, imageUrl }), null, imageUrl);
    assert.equal(publicPortalBranding({ ...defaultPortalPublicBranding, faviconUrl: imageUrl }), null, imageUrl);
  }
  assert.equal(publicPortalBranding({ ...defaultPortalPublicBranding, signInTitle: "" }), null);
  assert.equal(publicPortalBranding({ ...defaultPortalPublicBranding, welcomeDescription: "a".repeat(601) }), null);
  assert.equal(publicPortalBranding(undefined), null);
  assert.equal(publicPortalBranding({ document: { publicBranding: defaultPortalPublicBranding } }), null);
});

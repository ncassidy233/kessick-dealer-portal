import assert from "node:assert/strict";
import test from "node:test";
import { portalInvitationRedirectUrl } from "./portalInvitation";

test("dealer invitation redirects through sign-up to the portal", () => {
  assert.equal(
    portalInvitationRedirectUrl("https://portal.example", "/", "dealer"),
    "https://portal.example/sign-up?redirect_url=%2Fportal",
  );
});

test("staff invitation preserves an application base path", () => {
  assert.equal(
    portalInvitationRedirectUrl("https://portal.example", "/preview/", "staff"),
    "https://portal.example/preview/sign-up?redirect_url=%2Fpreview%2Fadmin",
  );
});

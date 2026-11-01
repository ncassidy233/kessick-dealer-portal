import { expect, test } from "@playwright/test";

const dealerA = "11111111-1111-4111-8111-111111111111";
const dealerB = "22222222-2222-4222-8222-222222222222";
const capabilities = ["admin:overview", "dealer-view:read", "users:read", "content:read"];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/portal-v2/bootstrap") return route.fulfill({ json: { role: "staff_admin", authorized: true, capabilities, groups: [], account: { id: "staff", displayName: "Staff member", status: "approved" } } });
    if (url.pathname === "/api/portal-v2/admin/overview") return route.fulfill({ json: { counts: { dealers: 2, approvedDealers: 2, staff: 1, groups: 0, content: 0, notifications: 0, unreadAcknowledgements: 0 }, recentAudit: [] } });
    if (url.pathname === "/api/staff/dealer-view") return route.fulfill({ json: { dealers: [{ id: dealerA, displayName: "Dealer A" }, { id: dealerB, displayName: "Dealer B" }] } });
    const match = /^\/api\/staff\/dealer-view\/([^/]+)(\/.*)$/.exec(url.pathname);
    if (!match) return route.fulfill({ status: 403, json: { error: "Unexpected or unauthorized request." } });
    const [, id, path] = match;
    if (route.request().method() !== "GET") return route.fulfill({ status: 403, json: { error: "Read-only" } });
    if (path === "/portal-v2/bootstrap") return route.fulfill({ json: { role: "dealer", authorized: true, capabilities: ["content:read"], groups: [], account: { id, displayName: id === dealerA ? "Dealer A" : "Dealer B", email: "dealer@example.invalid", status: "approved" } } });
    if (path === "/dealer-portal/access") return route.fulfill({ json: { capabilities: { "page:pricing": false } } });
    if (path === "/portal-v2/content") return route.fulfill({ json: { content: url.searchParams.get("kind") === "announcement" ? [{ id: "published", kind: "announcement", title: id === dealerA ? "Published for Dealer A" : "Published for Dealer B", published: true, payload: { url: "/portal/forms" }, createdAt: new Date().toISOString() }] : [] } });
    if (path.startsWith("/portal-v2/pages/")) return route.fulfill({ status: 404, json: { error: "No published layout" } });
    if (path === "/portal-v2/projects") return route.fulfill({ json: { content: [] } });
    if (path === "/portal-v2/notifications") return route.fulfill({ json: { notifications: [{ notification: { id: "notice", title: id === dealerA ? "Notice for Dealer A" : "Notice for Dealer B", body: "Published notice", priority: "normal", acknowledgementRequired: true, linkUrl: `${url.origin}/api/dealer-portal/resources/${dealerA}/file` }, recipient: { id: "recipient", notificationId: "notice", readAt: null, acknowledgedAt: null } }] } });
    if (path === "/portal-v2/notification-preferences") return route.fulfill({ json: { preferences: { inAppEnabled: true, pushEnabled: false, priorityThreshold: "normal" } } });
    if (path === "/dealer-portal/push-config") return route.fulfill({ json: { configured: true, publicKey: "test-key" } });
    if (path === "/dealer-portal/pricing") return route.fulfill({ json: [] });
    if (path === "/dealer-portal/resources") return route.fulfill({ json: [{ id: dealerA, title: id === dealerA ? "Legacy Dealer A resource" : "Legacy Dealer B resource", category: "Guides", url: `/api/dealer-portal/resources/${dealerA}/file` }] });
    if (path === `/dealer-portal/resources/${dealerA}/file`) return route.fulfill({ contentType: "application/pdf", body: "Dealer resource" });
    if (path === "/dealer-portal/forms") return route.fulfill({ json: [{
      id: dealerA, title: "Dealer request form", description: "Published request fields", enabled: true,
      fieldDefinitions: [
        { name: "projectName", label: "Project name", type: "text", required: true },
        { name: "details", label: "Project details", type: "textarea" },
        { name: "collection", label: "Collection", type: "select", options: ["Estate", "Reserve"] },
      ],
    }] });
    return route.fulfill({ status: 403, json: { error: "Not available" } });
  });
});

test("staff switch into actual published dealer components and back without logout", async ({ page }, testInfo) => {
  await page.goto("/admin");
  if (testInfo.project.name === "phone") await page.getByRole("button", { name: "All staff tools", exact: true }).click();
  await page.getByRole("link", { name: "View a specific dealer", exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Dealer View — published content" })).toBeVisible();
  await expect(page.getByText("Staff View — Read Only", { exact: true })).toBeVisible();
  await page.getByLabel("View as dealer").selectOption(dealerA);
  await expect(page).toHaveURL(new RegExp(`/admin/dealer-view/${dealerA}/portal$`));
  await expect(page.getByText("Published for Dealer A", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View announcement" })).toHaveAttribute("href", new RegExp(`/admin/dealer-view/${dealerA}/portal/forms$`));
  await expect(page.getByText("Draft secret")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pricing", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`dealer-view-${testInfo.project.name}.png`), animations: "disabled" });
  await page.getByRole("link", { name: "Account", exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  await expect(page.getByLabel("Email Address")).toHaveValue("dealer@example.invalid");
  await page.getByLabel("View as dealer").selectOption(dealerB);
  await expect(page.getByText("Published for Dealer B", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Published for Dealer A", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Administration" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back, Staff.", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
});

test("search filters approved dealers without changing staff identity", async ({ page }) => {
  await page.goto("/admin/dealer-view");
  await page.getByRole("searchbox", { name: "Search dealers" }).fill("Dealer B");
  await expect(page.getByRole("option", { name: "Dealer A", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Dealer B", exact: true })).toBeAttached();
  await page.getByLabel("View as dealer").selectOption(dealerB);
  await expect(page.getByText("Published for Dealer B", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Staff View — Read Only", { exact: true })).toBeVisible();
});

test("all inline pages use selected-account GETs and disable mutation and push initialization", async ({ page }) => {
  const unexpected: string[] = [];
  const writes: string[] = [];
  const reads: string[] = [];
  await page.addInitScript(() => {
    (window as Window & { previewInitializations: string[] }).previewInitializations = [];
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register = async () => {
        (window as Window & { previewInitializations: string[] }).previewInitializations.push("service-worker");
        throw new Error("Staff preview must not initialize service workers");
      };
    }
    if ("Notification" in window) {
      Notification.requestPermission = async () => {
        (window as Window & { previewInitializations: string[] }).previewInitializations.push("notification-permission");
        return "denied";
      };
    }
  });
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) return;
    reads.push(path);
    if (request.method() !== "GET") writes.push(path);
    if (!path.startsWith("/api/staff/dealer-view") && path !== "/api/portal-v2/bootstrap") unexpected.push(path);
  });
  await page.goto(`/admin/dealer-view/${dealerA}/portal/resources`);
  await expect(page.getByText("Legacy Dealer A resource", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download File" })).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download File" }).click();
  await download;
  // Client-side selection keeps the same document and QueryClient.
  await page.evaluate(() => { (window as Window & { samePreviewDocument: boolean }).samePreviewDocument = true; });
  await page.getByLabel("View as dealer").selectOption(dealerB);
  await expect(page.getByText("Published for Dealer B", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Resources", exact: true }).filter({ visible: true }).first().click().catch(async () => {
    // The phone portal exposes Resources through the dashboard toolkit.
    await page.getByRole("link", { name: /Resources/ }).filter({ visible: true }).first().click();
  });
  await expect(page.getByText("Legacy Dealer B resource", { exact: true })).toBeVisible();
  await expect(page.getByText("Legacy Dealer A resource", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download File" })).toBeEnabled();
  const dealerBDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download File" }).click();
  await dealerBDownload;
  expect(await page.evaluate(() => (window as Window & { samePreviewDocument?: boolean }).samePreviewDocument)).toBe(true);
  await page.goto(`/admin/dealer-view/${dealerB}/portal/notifications`);
  await expect(page.getByText("Notice for Dealer B", { exact: true })).toBeVisible();
  await expect(page.getByText("Notice for Dealer A", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open announcement link" })).toHaveAttribute("href", `/api/staff/dealer-view/${dealerB}/dealer-portal/resources/${dealerA}/file`);
  await page.getByText("Notification preferences", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Enable push on this device" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Show in-app announcements" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Receive push alerts on registered devices" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Minimum push priority" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Acknowledge", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Mark as read", exact: true })).toBeDisabled();
  for (const section of ["projects", "collections", "training", "pricing", "forms", "account"]) {
    await page.goto(`/admin/dealer-view/${dealerB}/portal/${section}`);
    await expect(page.getByText("Staff View — Read Only", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh dealer permissions" })).toBeVisible();
    if (section === "account") await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  }
  expect(reads).toContain(`/api/staff/dealer-view/${dealerB}/dealer-portal/pricing`);
  expect(reads).toContain(`/api/staff/dealer-view/${dealerB}/dealer-portal/forms`);
  expect(reads).toContain(`/api/staff/dealer-view/${dealerB}/dealer-portal/push-config`);
  expect(reads).toContain(`/api/staff/dealer-view/${dealerA}/dealer-portal/resources/${dealerA}/file`);
  expect(reads).toContain(`/api/staff/dealer-view/${dealerB}/dealer-portal/resources/${dealerA}/file`);
  expect(writes).toEqual([]);
  expect(unexpected).toEqual([]);
  expect(await page.evaluate(() => (window as Window & { previewInitializations: string[] }).previewInitializations)).toEqual([]);
});

test("staff can inspect forms and retry read failures without enabling writes", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/") && request.method() !== "GET") writes.push(request.url());
  });
  await page.goto(`/admin/dealer-view/${dealerA}/portal/forms`);
  const formCard = page.getByRole("button", { name: "Dealer request form Published request fields" });
  await expect(formCard).toBeEnabled();
  await formCard.click();
  await expect(page.getByRole("heading", { name: "Dealer request form" })).toBeVisible();
  await expect(page.getByLabel("Project name", { exact: false })).toBeDisabled();
  await expect(page.getByLabel("Project details", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Collection", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Submit Form", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Back to Forms" })).toBeEnabled();
  await page.getByRole("button", { name: "Back to Forms" }).click();
  await expect(formCard).toBeEnabled();
  await page.route(`**/api/staff/dealer-view/${dealerA}/portal-v2/notifications`, route => route.fulfill({ status: 503, json: { error: "Try again" } }), { times: 1 });
  let preferencesAvailable = false;
  await page.route(`**/api/staff/dealer-view/${dealerA}/portal-v2/notification-preferences`, route => preferencesAvailable
    ? route.fulfill({ json: { preferences: { inAppEnabled: true, pushEnabled: false, priorityThreshold: "normal" } } })
    : route.fulfill({ status: 503, json: { error: "Try again" } }));
  await page.goto(`/admin/dealer-view/${dealerA}/portal/notifications`);
  await expect(page.getByRole("heading", { name: "Notices could not be loaded" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Notice for Dealer A", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeEnabled();
  preferencesAvailable = true;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("Notification preferences", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Show in-app announcements" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Acknowledge", exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("dealer selection rejects malformed account identifiers", async ({ page }) => {
  await page.goto("/admin/dealer-view");
  const selector = page.getByLabel("View as dealer");
  await expect(selector.getByRole("option", { name: "Dealer A", exact: true })).toBeAttached();
  await selector.evaluate(element => (element as HTMLSelectElement).add(new Option("Invalid dealer", "../../admin/users")));
  await selector.selectOption("../../admin/users");
  await expect(page).toHaveURL(/\/admin\/dealer-view$/);
});

test("dealer identities cannot render staff preview controls", async ({ page }) => {
  await page.route("**/api/portal-v2/bootstrap", route => route.fulfill({ json: { role: "dealer", authorized: true, capabilities: ["content:read"], groups: [], account: { id: dealerA, status: "approved" } } }));
  await page.goto("/admin/dealer-view");
  await expect(page.getByTestId("state-staff-access-denied")).toBeVisible();
  await expect(page.getByLabel("View as dealer")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Switch to Dealer View" })).toHaveCount(0);
});

test("revoked dealer preview fails closed even when published data was cached", async ({ page }) => {
  await page.goto(`/admin/dealer-view/${dealerA}/portal`);
  await expect(page.getByText("Published for Dealer A", { exact: true }).first()).toBeVisible();
  await page.route(`**/api/staff/dealer-view/${dealerA}/portal-v2/bootstrap`, route => route.fulfill({ status: 403, json: { error: "Dealer revoked" } }));
  await page.getByRole("button", { name: "Refresh dealer permissions" }).click();
  await expect(page.getByText("This dealer preview is unavailable. Access remains locked.")).toBeVisible();
  await expect(page.getByText("Published for Dealer A", { exact: true })).toHaveCount(0);
});

test("trimmed optional DTOs render safely and CMS destinations stay in dealer context", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`**/api/staff/dealer-view/${dealerA}/portal-v2/bootstrap`, route => route.fulfill({ json: {
    role: "dealer", authorized: true, capabilities: [],
    account: { id: dealerA, email: "dealer@example.invalid", displayName: null, status: "approved" },
  } }));
  await page.route(`**/api/staff/dealer-view/${dealerA}/portal-v2/projects`, route => route.fulfill({ json: { content: [
    { id: "sparse", kind: "project", title: "Trimmed project", published: true, description: null, payload: null, updatedAt: null },
    { id: "unsafe", kind: "project", title: "Unsafe media", published: true, payload: { imageUrl: "data:image/svg+xml,bad", url: "javascript:alert(1)" }, updatedAt: "invalid" },
    { id: "linked", kind: "project", title: "Dealer project", published: true, payload: { url: "/portal/forms" } },
  ] } }));
  await page.goto(`/admin/dealer-view/${dealerA}/portal/projects`);
  await expect(page.getByText("Trimmed project", { exact: true })).toBeVisible();
  await expect(page.getByText("Updated Unknown date", { exact: true })).toHaveCount(3);
  await expect(page.locator('img[src^="data:"]')).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open Project" })).toHaveAttribute("href", `/admin/dealer-view/${dealerA}/portal/forms`);
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Open Project" }).click();
  const linkedPage = await popup;
  await expect(linkedPage).toHaveURL(new RegExp(`/admin/dealer-view/${dealerA}/portal/forms$`));
  await linkedPage.close();
  await page.goto(`/admin/dealer-view/${dealerA}/portal/account`);
  await expect(page.getByLabel("Email Address")).toHaveValue("dealer@example.invalid");
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("public sample ignores selected-dealer URLs, query parameters, and inherited staff context", async ({ page }, testInfo) => {
  const privateReads: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/")) privateReads.push(request.url());
  });
  await page.goto("/portal/preview");
  const sample = page.locator("div.dealer-preview-surface");
  await expect(sample).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(image => image.getBoundingClientRect().top < window.innerHeight).map(image => image.decode().catch(() => {})));
  });
  const markup = await sample.evaluate(element => element.outerHTML);
  await page.screenshot({ path: testInfo.outputPath(`public-sample-${testInfo.project.name}.png`), animations: "disabled" });
  for (const [index, path] of [
    `/portal/preview?selectedDealerAccountId=${dealerA}&dealerId=${dealerA}&staffViewMode=1&readOnly=true`,
    `/portal/preview?selectedDealerAccountId=${dealerB}&dealerId=${dealerB}`,
    `/__e2e/dealer-preview-context?selectedDealerAccountId=${dealerA}`,
  ].entries()) {
    await page.goto(path);
    await expect(sample).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].filter(image => image.getBoundingClientRect().top < window.innerHeight).map(image => image.decode().catch(() => {})));
    });
    expect(await sample.evaluate(element => element.outerHTML)).toBe(markup);
    await page.screenshot({ path: testInfo.outputPath(`public-sample-selected-${index}-${testInfo.project.name}.png`), animations: "disabled" });
    await expect(page.getByLabel("View as dealer")).toHaveCount(0);
    await expect(page.getByLabel("Search dealers")).toHaveCount(0);
    await expect(page.getByText("Staff View — Read Only", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Published for Dealer A", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Published for Dealer B", { exact: true })).toHaveCount(0);
  }
  expect(privateReads).toEqual([]);
  expect(errors).toEqual([]);
});

test("delayed Dealer A responses never bleed into Dealer B on the shared client", async ({ page }, testInfo) => {
  let releaseA!: () => void;
  const gate = new Promise<void>(resolve => { releaseA = resolve; });
  let pending = 0;
  let settled = 0;
  for (const endpoint of ["portal-v2/projects", "dealer-portal/resources"]) {
    await page.route(`**/api/staff/dealer-view/${dealerA}/${endpoint}`, async route => {
      pending += 1;
      await gate;
      try {
        await route.fulfill({ json: endpoint === "portal-v2/projects"
          ? { content: [{ id: "late-a-project", kind: "project", title: "Delayed A private project", published: true, payload: {} }] }
          : [{ id: dealerA, title: "Delayed A private resource", category: "Guides", url: "https://example.invalid/a.pdf" }] });
      } finally { settled += 1; }
    });
  }
  await page.route(`**/api/staff/dealer-view/${dealerB}/portal-v2/projects`, route => route.fulfill({ json: { content: [
    { id: "b-project", kind: "project", title: "Dealer B private project", published: true, payload: {} },
  ] } }));
  await page.goto(`/admin/dealer-view/${dealerA}/portal`);
  await expect(page.getByText("Published for Dealer A", { exact: true }).first()).toBeVisible();
  await expect.poll(() => pending).toBe(2);
  await page.evaluate(() => { (window as Window & { samePreviewDocument: boolean }).samePreviewDocument = true; });
  await page.getByLabel("View as dealer").selectOption(dealerB);
  await expect(page.getByText("Published for Dealer B", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Dealer B private project", { exact: true })).toBeVisible();
  releaseA();
  await expect.poll(() => settled).toBe(2);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Published for Dealer A", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Delayed A private project", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Delayed A private resource", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Resources", exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByText("Legacy Dealer B resource", { exact: true })).toBeVisible();
  await expect(page.getByText("Delayed A private resource", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { samePreviewDocument?: boolean }).samePreviewDocument)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`dealer-b-isolation-${testInfo.project.name}.png`), animations: "disabled" });
});

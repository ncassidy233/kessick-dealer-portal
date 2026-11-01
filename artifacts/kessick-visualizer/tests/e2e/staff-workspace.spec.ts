import { expect, test } from "@playwright/test";
const accountId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const resourceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const capabilities = ["admin:overview", "dealer-view:read", "users:read", "users:write", "groups:read", "content:read", "content:write", "pages:publish", "pricing:read", "notifications:read"];

test.beforeEach(async ({ page }) => {
  let draft: unknown = null;
  await page.route("**/api/**", async route => {
    const { pathname, searchParams } = new URL(route.request().url());
    if (pathname === "/api/account") return route.fulfill({ json: { account: { id: accountId, role: "staff", status: "approved", email: "staff@example.invalid", displayName: "Nicholas Cassidy", emailVerified: true }, organization: null, membership: null } });
    if (pathname === "/api/portal-v2/bootstrap") return route.fulfill({ json: { role: "super_admin", authorized: true, capabilities, account: { id: accountId, status: "approved", email: "staff@example.invalid", displayName: "Nicholas Cassidy" }, groups: [] } });
    if (pathname === "/api/portal-v2/admin/overview") return route.fulfill({ json: { counts: { dealers: 12, approvedDealers: 10, staff: 2, groups: 3, content: 24, notifications: 4, unreadAcknowledgements: 0 }, recentAudit: [] } });
    if (pathname.endsWith("/draft")) {
      if (route.request().method() === "PUT") draft = { document: route.request().postDataJSON().document, revision: 1, updatedAt: new Date().toISOString(), updatedByAccountId: accountId };
      return route.fulfill({ json: { draft } });
    }
    if (pathname.endsWith("/history")) return route.fulfill({ json: { history: [], publishedRevision: 0 } });
    if (pathname === "/api/dealer-portal/access") return route.fulfill({ json: { groupId: null, groupIds: [], capabilities: {} } });
    if (pathname === "/api/dealer-portal/pricing") return route.fulfill({ json: [] });
    if (pathname === "/api/dealer-portal/resources") return route.fulfill({ json: [{ id: resourceId, title: "Staff installation guide", category: "Installation", url: "https://example.invalid/installation.pdf" }] });
    if (pathname === "/api/dealer-portal/forms") return route.fulfill({ json: [] });
    if (pathname === "/api/portal-v2/notifications") return route.fulfill({ json: { notifications: [] } });
    if (pathname === "/api/portal-v2/projects") return route.fulfill({ json: { content: [] } });
    if (pathname === "/api/portal-v2/content") return route.fulfill({ json: { content: searchParams.get("kind") === "resource" ? [{ id: resourceId, kind: "resource", title: "Staff installation guide", published: true, payload: { legacyId: resourceId } }] : [] } });
    return route.fulfill({ status: 404, json: { error: "No record" } });
  });
});

test("staff can find the editor on every screen and switch into the full dealer portal", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Welcome back, Nicholas." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open page editor", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open dealer portal", exact: true })).toBeVisible();
  expect(await page.locator(".staff-portal").first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`staff-overview-${testInfo.project.name}.png`), fullPage: true });
  if (testInfo.project.name === "phone") {
    await page.getByRole("navigation", { name: "Mobile staff navigation", exact: true }).getByRole("link", { name: "Editor", exact: true }).click();
  } else await page.getByRole("navigation", { name: "Staff navigation", exact: true }).getByRole("link", { name: "Layout & Theme", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/page-studio$/);
  await expect(page.getByRole("heading", { name: "Page Studio", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Draft", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("All changes saved");
  await page.screenshot({ path: testInfo.outputPath(`staff-editor-${testInfo.project.name}.png`), fullPage: true });
  await page.getByRole("navigation", { name: "Portal switch", exact: true }).filter({ visible: true }).getByRole("link", { name: "Dealer View", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Your Kessick project desk.", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff View", exact: true }).filter({ visible: true })).toBeVisible();
  if (testInfo.project.name === "phone") {
    await page.getByRole("button", { name: "All dealer pages", exact: true }).click();
    await page.getByRole("navigation", { name: "All portal tools", exact: true }).getByRole("link", { name: "Pricing", exact: true }).click();
  } else await page.getByRole("navigation", { name: "Dealer navigation", exact: true }).getByRole("link", { name: "Pricing", exact: true }).click();
  await expect(page).toHaveURL(/\/portal\/pricing$/);
  await expect(page.getByRole("heading", { name: /Pricing/ }).first()).toBeVisible();
  if (testInfo.project.name === "phone") {
    await page.getByRole("button", { name: "All dealer pages", exact: true }).click();
    await page.getByRole("navigation", { name: "All portal tools", exact: true }).getByRole("link", { name: "Resources", exact: true }).click();
  } else await page.getByRole("navigation", { name: "Dealer navigation", exact: true }).getByRole("link", { name: "Resources", exact: true }).click();
  await expect(page).toHaveURL(/\/portal\/resources$/);
  await expect(page.getByText("Staff installation guide").first()).toBeVisible();
  await page.getByRole("navigation", { name: "Portal switch", exact: true }).filter({ visible: true }).getByRole("link", { name: "Staff View", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back, Nicholas." })).toBeVisible();
  if (testInfo.project.name === "phone") {
    await page.getByRole("button", { name: "More staff tools", exact: true }).click();
    for (const name of ["Layout & Theme", "Access rules", "Activity log"]) await expect(page.getByRole("navigation", { name: "All portal tools", exact: true }).getByRole("link", { name, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("sales staff have dealer access while navigation respects knowledge permissions", async ({ page }, testInfo) => {
  await page.route("**/api/portal-v2/bootstrap", route => route.fulfill({ json: { role: "sales_rep", authorized: true, capabilities: ["content:read", "users:read", "groups:read", "notifications:read"], account: { id: accountId, status: "approved", email: "sales@example.invalid", displayName: "Sales Staff" }, groups: [] } }));
  await page.route("**/api/portal-v2/admin/pages/home/draft", route => route.fulfill({ json: { draft: { document: { schemaVersion: 1, title: "Dealer home", sections: [{ id: resourceId, type: "text", heading: "Published welcome", body: "Dealer resources", background: "light", spacing: "comfortable" }] }, revision: 1, updatedAt: new Date().toISOString(), updatedByAccountId: accountId } } }));
  await page.goto("/admin/page-studio");
  await expect(page.getByRole("heading", { name: "Page Studio", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Concierge knowledge", exact: true })).toHaveCount(0);
  if (testInfo.project.name === "phone") {
    await page.getByRole("button", { name: "All staff tools", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "All portal tools", exact: true }).getByRole("link", { name: "Concierge knowledge", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByRole("navigation", { name: "Portal switch", exact: true }).filter({ visible: true }).getByRole("link", { name: "Dealer View", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Your Kessick project desk.", exact: true })).toBeVisible();
});

test("staff authors a targeted quote offer and dealers see its terms and official forms", async ({ page }, testInfo) => {
  const offerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  let saved: any = null;
  await page.route("**/api/**", async route => {
    const { pathname, searchParams } = new URL(route.request().url());
    if (pathname === "/api/portal-v2/admin/content") {
      if (route.request().method() === "POST") saved = { ...route.request().postDataJSON(), id: offerId, updatedAt: new Date().toISOString(), targets: { groupIds: [], accountIds: [] } };
      return route.fulfill({ json: route.request().method() === "POST" ? { content: saved } : { content: saved ? [saved] : [] } });
    }
    if (pathname === "/api/portal-v2/admin/groups") return route.fulfill({ json: { groups: [] } });
    if (pathname === "/api/portal-v2/admin/users") return route.fulfill({ json: { users: [] } });
    if (["/api/staff/portal/forms", "/api/staff/portal/resources", "/api/staff/portal/form-submissions"].includes(pathname)) return route.fulfill({ json: [] });
    if (pathname === "/api/portal-v2/content" && searchParams.get("kind") === "announcement") return route.fulfill({ json: { content: saved ? [saved] : [] } });
    if (pathname === "/api/portal-v2/content" && searchParams.get("kind") === "form") return route.fulfill({ json: { content: [{ id: resourceId, title: "Design Request", kind: "form", published: true, payload: { externalForm: true, url: "https://kessickwinecellars.com/design-request/" } }] } });
    return route.fallback();
  });
  await page.goto("/admin/content");
  await page.getByRole("button", { name: "New discount", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Estate trade offer — test data");
  await page.getByLabel("Percent off", { exact: true }).fill("12");
  await page.getByLabel("Starts (your local time)").fill(new Date(Date.now() - 86400000).toISOString().slice(0,16));
  await page.getByLabel("Ends (your local time)").fill(new Date(Date.now() + 86400000).toISOString().slice(0,16));
  await page.getByLabel("Eligible collections, separated by commas").fill("Estate");
  await page.getByLabel("Minimum order (USD)").fill("1000");
  await page.getByLabel("Maximum savings (USD, optional)").fill("500");
  await page.getByLabel("Terms and exclusions").fill("New Estate quotes only. Excludes freight. Kessick approval required.");
  await page.getByLabel("Publish immediately", { exact: true }).check();
  if (testInfo.project.name === "desktop") { await page.getByLabel("Title", { exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath("staff-editor-valid-offer-desktop.png"), animations: "disabled" }); }
  await page.getByRole("button", { name: "Create content", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(saved.payload.promotion).toMatchObject({ percentOff: 12, minimumOrder: 1000, maximumSavings: 500, collections: ["Estate"], combinable: false });
  expect(saved.visibility).toBe("everyone");
  await expect(page.getByText("Active offer", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.goto("/portal");
  const offer = page.getByRole("region", { name: "Dealer discount", exact: true });
  await expect(offer).toContainText("12% off");
  await expect(offer).toContainText("Maximum savings $500");
  await offer.getByText("Offer terms & eligibility", { exact: true }).click();
  await expect(offer).toContainText("Excludes freight");
  const toolkit = page.locator('section[aria-labelledby="toolkit-heading"]');
  expect(await toolkit.evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(244, 244, 250)");
  await expect(toolkit.locator("img")).toHaveCount(1);
  expect(await toolkit.evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(260);
  await expect(page.getByRole("img", { name: "Kessick wine cellar installation", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath(`dealer-light-offer-${testInfo.project.name}.png`), fullPage: true });
  await toolkit.screenshot({ path: testInfo.outputPath(`compact-toolkit-${testInfo.project.name}.png`), animations: "disabled" });
  await offer.getByRole("link", { name: "Request an eligible quote", exact: true }).click();
  await expect(page.getByRole("region", { name: "Requested offer" })).toContainText(offerId);
  await expect(page.getByRole("link", { name: /Design Request/ })).toHaveAttribute("href", "https://kessickwinecellars.com/design-request/");
  await expect(page.getByRole("link", { name: /Design Request/ })).toContainText("Your submission is handled there");
});

test("staff sees edits before saving and is protected from accidental content loss", async ({ page }, testInfo) => {
  const exampleRecord = { id: resourceId, title: "Estate catalog", description: "Official collection information", kind: "resource", payload: { url: "https://kessickwinecellars.com/estate/" }, published: true, visibility: "everyone", targets: { groupIds: [], accountIds: [] }, updatedAt: new Date().toISOString() };
  const oldOffer = { ...exampleRecord, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", title: "Previous offer", kind: "announcement", payload: { promotion: { percentOff: 37, startsAt: new Date(Date.now() - 86400000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), collections: ["Reserve"], terms: "Previous offer rules", minimumOrder: 5000, maximumSavings: 99, combinable: true } } };
  const regularAnnouncement = { ...exampleRecord, id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", title: "Regular announcement", kind: "announcement", payload: {}, published: false };
  await page.route("**/api/**", async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/portal-v2/admin/content") return route.fulfill({ json: { content: [exampleRecord, oldOffer, regularAnnouncement] } });
    if (pathname === "/api/portal-v2/admin/groups") return route.fulfill({ json: { groups: [] } });
    if (pathname === "/api/portal-v2/admin/users") return route.fulfill({ json: { users: [] } });
    if (["/api/staff/portal/forms", "/api/staff/portal/resources", "/api/staff/portal/form-submissions"].includes(pathname)) return route.fulfill({ json: [] });
    return route.fallback();
  });
  await page.goto("/admin");
  if (testInfo.project.name === "phone") await page.getByRole("button", { name: "More staff tools", exact: true }).click();
  await page.getByRole("link", { name: "Content & resources", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("button", { name: "Edit Estate catalog", exact: true }).filter({ visible: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Edit Previous offer", exact: true }).filter({ visible: true }).click();
  await expect(page.getByLabel("Percent off", { exact: true })).toHaveValue("37");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Edit Regular announcement", exact: true }).filter({ visible: true }).click();
  await page.getByLabel("Discount / quote offer", { exact: true }).check();
  await expect(page.getByLabel("Percent off", { exact: true })).toHaveValue("15");
  await expect(page.getByLabel("Starts (your local time)")).toHaveValue("");
  await expect(page.getByLabel("Terms and exclusions")).toHaveValue("");
  await expect(page.getByLabel("Maximum savings (USD, optional)")).toHaveValue("");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "New discount", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Preview offer — test data");
  const unlabeledFields = await page.getByRole("dialog").locator("input, select, textarea").evaluateAll(fields => fields.filter(field => field.getClientRects().length && !field.getAttribute("aria-label") && !field.getAttribute("aria-labelledby") && !(field as HTMLInputElement).labels?.length).map(field => field.outerHTML));
  expect(unlabeledFields).toEqual([]);
  await page.getByLabel("Percent off", { exact: true }).fill("18");
  await page.getByRole("button", { name: "Create content", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Choose a valid start date" })).toBeVisible();
  await page.getByLabel("Starts (your local time)").fill(new Date().toISOString().slice(0,16));
  if (testInfo.project.name !== "desktop") await page.getByRole("button", { name: "Preview changes", exact: true }).click();
  const preview = page.getByRole("region", { name: "Discount preview", exact: true });
  await expect(preview).toContainText("18% off · Preview offer — test data");
  await expect(preview).toContainText("End date required");
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toContainText("Will save as draft");
  await page.screenshot({ path: testInfo.outputPath(`staff-content-live-preview-${testInfo.project.name}.png`), animations: "disabled" });
  if (testInfo.project.name !== "desktop") await page.getByRole("button", { name: "Back to fields", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Preview offer — test data");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Welcome back, Nicholas." })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Preview offer — test data");
  await expect(page.getByLabel("Percent off", { exact: true })).toHaveValue("18");
  page.once("dialog", async dialog => { expect(dialog.message()).toContain("unsaved content changes"); await dialog.dismiss(); });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/admin/page-studio");
  if (testInfo.project.name !== "desktop") await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Heading", { exact: true }).fill("See this change before publishing");
  await expect(page.getByText("Save your draft before publishing.", { exact: false })).toBeVisible();
  if (testInfo.project.name === "desktop") {
    await expect(page.frameLocator('iframe[title="Kessick draft device preview"]').getByRole("heading", { name: "See this change before publishing", exact: true })).toBeVisible();
  } else {
    await expect(page.getByLabel("Live section preview", { exact: true }).getByRole("heading", { name: "See this change before publishing", exact: true })).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath(`staff-studio-live-preview-${testInfo.project.name}.png`), animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

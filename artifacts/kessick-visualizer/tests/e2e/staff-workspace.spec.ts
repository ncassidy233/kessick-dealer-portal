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

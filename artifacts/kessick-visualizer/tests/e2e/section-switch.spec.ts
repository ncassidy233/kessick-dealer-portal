import { expect, test, type Page } from "@playwright/test";
const accountId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const finishId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const dealerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const capabilities = ["content:read", "content:write", "pages:publish", "groups:read", "users:read", "dealer-view:read", "pricing:read", "notifications:read"];
async function controls(page: Page, readOnly = false) {
  const records = [
    { id: finishId, kind: "finish", title: "White Oak", description: "Current finish details", published: true, visibility: "everyone", payload: {}, createdAt: new Date().toISOString() },
    { id: "series", kind: "product_series", title: "Estate Collection", published: true, visibility: "everyone", payload: {}, createdAt: new Date().toISOString() },
    { id: "guide", kind: "resource", title: "Unrelated installation guide", published: true, payload: {}, createdAt: new Date().toISOString() },
  ];
  let edits = 0;
  const reads: string[] = [];
  await page.route("**/api/**", async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    reads.push(path);
    if (path === "/api/account") return route.fulfill({ json: { account: { id: accountId, role: "staff", status: "approved", email: "staff@example.invalid", emailVerified: true }, organization: null, membership: null } });
    if (path === "/api/portal-v2/bootstrap") return route.fulfill({ json: { role: readOnly ? "sales_rep" : "super_admin", authorized: true, capabilities: readOnly ? ["content:read", "dealer-view:read"] : capabilities, account: { id: accountId, status: "approved" }, groups: [] } });
    if (path.startsWith("/api/portal-v2/admin/content/")) {
      expect(req.method()).toBe("PATCH"); expect(readOnly).toBe(false);
      Object.assign(records[0], req.postDataJSON()); edits++;
      return route.fulfill({ json: { content: records[0] } });
    }
    if (path === "/api/portal-v2/admin/content") return route.fulfill({ json: { content: records } });
    if (path === "/api/portal-v2/admin/groups") return route.fulfill({ json: { groups: [] } });
    if (path === "/api/portal-v2/admin/users") return route.fulfill({ json: { users: [] } });
    if (path.startsWith("/api/staff/portal/")) return route.fulfill({ json: [] });
    if (path.endsWith("/draft")) return route.fulfill({ json: { draft: { revision: 1, document: { schemaVersion: 1, title: "Collections", sections: [] }, updatedAt: new Date().toISOString(), updatedByAccountId: accountId } } });
    if (path.endsWith("/history")) return route.fulfill({ json: { history: [], publishedRevision: 0 } });
    if (path === "/api/staff/dealer-view") return route.fulfill({ json: { dealers: [{ id: dealerId, displayName: "Sample Dealer", email: "dealer@example.invalid" }] } });
    if (path === `/api/staff/dealer-view/${dealerId}/portal-v2/bootstrap`) return route.fulfill({ json: { role: "dealer", authorized: true, capabilities: ["content:read"], account: { id: dealerId, status: "approved" }, groups: [] } });
    if (path.endsWith("/content")) return route.fulfill({ json: { content: records.filter(r => r.kind === url.searchParams.get("kind")) } });
    if (path.endsWith("/access")) return route.fulfill({ json: { capabilities: {} } });
    if (path.endsWith("/notifications")) return route.fulfill({ json: { notifications: [] } });
    if (path.includes("/pages/")) return route.fulfill({ status: 404, json: { error: "No custom layout" } });
    return route.fulfill({ status: 404, json: { error: "Unknown test route" } });
  });
  return { edits: () => edits, reads };
}
const switchLink = (page: Page, name: string) => page.getByRole("navigation", { name: "Portal switch", exact: true }).filter({ visible: true }).getByRole("link", { name, exact: true });

test("Collections opens its content controls, saves a finish image and returns to the same dealer page", async ({ page }, testInfo) => {
  const fixture = await controls(page);
  await page.goto("/portal/collections");
  await expect(page.getByRole("heading", { name: "White Oak", exact: true })).toBeVisible();
  await switchLink(page, "Staff View").click();
  await expect(page).toHaveURL(/\/admin\/content\?section=collections$/);
  await expect(page.getByRole("region", { name: "Collections editing tools" })).toBeVisible();
  await expect(page.getByText("Unrelated installation guide", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Form submissions", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Finishes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Estate Collection", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit White Oak", exact: true }).filter({ visible: true }).click();
  await page.getByPlaceholder("https://images.example.com/card.jpg").fill("http://127.0.0.1:5173/kessick-headquarters-hero.webp");
  await page.getByRole("button", { name: "Save content", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(fixture.edits()).toBe(1);
  await page.getByRole("link", { name: "Visual layout", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/page-studio\?page=collections$/);
  await expect(page.getByRole("combobox", { name: "Page", exact: true })).toHaveValue("collections");
  await expect(page.getByRole("button", { name: "Save Draft", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Content & images", exact: true }).click();
  await expect(page).toHaveURL(/section=collections$/);
  await page.screenshot({ path: testInfo.outputPath(`collections-controls-${testInfo.project.name}.png`), animations: "disabled" });
  await switchLink(page, "Dealer View").click();
  await expect(page).toHaveURL(/\/portal\/collections$/);
  await expect(page.getByRole("img", { name: "White Oak", exact: true })).toHaveAttribute("src", "http://127.0.0.1:5173/kessick-headquarters-hero.webp");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("direct layout links and page selection preserve context across browser history", async ({ page }) => {
  await controls(page);
  await page.goto("/admin/page-studio?page=collections");
  await expect(page.getByRole("combobox", { name: "Page", exact: true })).toHaveValue("collections");
  await page.getByRole("combobox", { name: "Page", exact: true }).selectOption("training");
  await expect(page).toHaveURL(/page=training$/);
  await page.goBack();
  await expect(page.getByRole("combobox", { name: "Page", exact: true })).toHaveValue("collections");
  await switchLink(page, "Dealer View").click();
  await expect(page).toHaveURL(/\/portal\/collections$/);
});
test("read-only staff land on the right section without gaining editing or publishing controls", async ({ page }) => {
  const fixture = await controls(page, true);
  await page.goto("/portal/collections");
  await switchLink(page, "Staff View").click();
  await expect(page.getByRole("region", { name: "Collections editing tools" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit White Oak", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New content", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Visual layout", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save Draft", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
  expect(fixture.edits()).toBe(0);
});
test("selected-dealer editing returns to the same dealer and section using staff-scoped controls", async ({ page }) => {
  const fixture = await controls(page);
  await page.goto(`/admin/dealer-view/${dealerId}/portal/collections`);
  await page.getByRole("link", { name: "Edit this page", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/content\\?section=collections&dealer=${dealerId}$`));
  await expect(page.getByText("Content changes apply to the shared portal, not just this dealer.", { exact: false })).toBeVisible();
  expect(fixture.reads).toContain("/api/portal-v2/admin/content");
  expect(fixture.reads.some(path => path.includes(`/staff/dealer-view/${dealerId}/portal-v2/admin/`))).toBe(false);
  await switchLink(page, "Dealer View").click();
  await expect(page).toHaveURL(new RegExp(`/admin/dealer-view/${dealerId}/portal/collections$`));
  await expect(page.getByText("Staff View — Read Only", { exact: true })).toBeVisible();
});

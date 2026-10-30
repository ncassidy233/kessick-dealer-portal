import { expect, test } from "@playwright/test";

const dealerA = "11111111-1111-4111-8111-111111111111";
const dealerB = "22222222-2222-4222-8222-222222222222";
const capabilities = ["admin:overview", "dealer-view:read", "users:read", "content:read"];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/portal-v2/bootstrap") return route.fulfill({ json: { role: "staff_admin", authorized: true, capabilities, groups: [], account: { id: "staff", displayName: "Staff member", status: "approved" } } });
    if (url.pathname === "/api/staff/dealer-view") return route.fulfill({ json: { dealers: [{ id: dealerA, displayName: "Dealer A" }, { id: dealerB, displayName: "Dealer B" }] } });
    const match = /^\/api\/staff\/dealer-view\/([^/]+)(\/.*)$/.exec(url.pathname);
    if (!match) return route.fulfill({ status: 403, json: { error: "Unexpected or unauthorized request." } });
    const [, id, path] = match;
    if (route.request().method() !== "GET") return route.fulfill({ status: 403, json: { error: "Read-only" } });
    if (path === "/portal-v2/bootstrap") return route.fulfill({ json: { role: "dealer", authorized: true, capabilities: ["content:read"], groups: [], account: { id, displayName: id === dealerA ? "Dealer A" : "Dealer B", email: "dealer@example.invalid", status: "approved" } } });
    if (path === "/dealer-portal/access") return route.fulfill({ json: { capabilities: { "page:pricing": false } } });
    if (path === "/portal-v2/content") return route.fulfill({ json: { content: url.searchParams.get("kind") === "announcement" ? [{ id: "published", kind: "announcement", title: id === dealerA ? "Published for Dealer A" : "Published for Dealer B", published: true, payload: { url: `${url.origin}/portal/forms` }, visibility: "everyone", createdAt: new Date().toISOString() }] : [] } });
    if (path === "/portal-v2/projects") return route.fulfill({ json: { content: [] } });
    if (path === "/portal-v2/notifications") return route.fulfill({ json: { notifications: [] } });
    if (path === "/dealer-portal/resources" || path === "/dealer-portal/forms") return route.fulfill({ json: [] });
    return route.fulfill({ status: 403, json: { error: "Not available" } });
  });
});

test("staff switch into actual published dealer components and back without logout", async ({ page }, testInfo) => {
  await page.goto("/admin");
  await page.getByRole("link", { name: "Switch to Dealer View", exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Dealer View — published content" })).toBeVisible();
  await page.getByLabel("View as dealer").selectOption(dealerA);
  await expect(page).toHaveURL(new RegExp(`/admin/dealer-view/${dealerA}/portal$`));
  await expect(page.getByText("Published for Dealer A", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View announcement" })).toHaveAttribute("href", new RegExp(`/admin/dealer-view/${dealerA}/portal/forms$`));
  await expect(page.getByText("Draft secret")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pricing", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`dealer-view-${testInfo.project.name}.png`), fullPage: true });
  await page.getByRole("link", { name: "Account", exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  await expect(page.getByLabel("Email Address")).toHaveValue("dealer@example.invalid");
  await page.getByLabel("View as dealer").selectOption(dealerB);
  await expect(page.getByText("Published for Dealer B", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Published for Dealer A", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Administration" }).click();
  await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
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

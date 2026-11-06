import { expect, test } from "@playwright/test";

test("legacy preview links enter the protected portal without exposing the obsolete sample", async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_AUTH_REVIEW !== "1" || !process.env.PLAYWRIGHT_BASE_URL, "Requires a production build with the app's public Clerk browser configuration");
  test.setTimeout(90_000);
  const privateReads: string[] = [];
  page.on("request", request => {
    if (/^\/api\/(?:portal(?:-v2)?|staff)(?:\/|$)/.test(new URL(request.url()).pathname)) {
      privateReads.push(request.url());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /The Private Portal/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /preview/i })).toHaveCount(0);

  for (const path of ["/portal/preview", "/portal/preview?selectedDealerAccountId=old-bookmark", "/admin/preview"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Welcome back.", exact: true })).toBeVisible();
    await expect(page.locator(".dealer-preview-surface")).toHaveCount(0);
    await expect(page.getByText("Sample data only.", { exact: false })).toHaveCount(0);
  }
  expect(privateReads).toEqual([]);
});

test("one neutral sign-in supports returning users without advertising privileged workspaces", async ({ page }, testInfo) => {
  test.skip(process.env.PLAYWRIGHT_AUTH_REVIEW !== "1", "Requires the app's public Clerk browser configuration");
  test.setTimeout(90_000);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const path of ["/sign-in", "/sign-in?redirect_url=%2Fadmin"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Welcome back.", exact: true })).toBeVisible();
      const email = page.getByRole("textbox", { name: "Email address", exact: true });
      await expect(email).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("link", { name: "Sign up", exact: true })).toHaveCount(0);
      expect(await page.locator("body").innerText()).not.toMatch(/staff|admin|super.admin/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const button = page.getByRole("button", { name: "Continue", exact: true });
      expect(await button.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      await expect(email).toHaveAttribute("autocomplete", "email");
      await button.click();
      await expect(email).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath(`login-${viewport.width}-${path.includes("redirect") ? "bookmark" : "generic"}.png`), animations: "disabled" });
    }
  }
});

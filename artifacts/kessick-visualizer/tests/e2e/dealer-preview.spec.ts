import { expect, test } from "@playwright/test";

test.skip(
  process.env.PLAYWRIGHT_DEALER_PREVIEW !== "1",
  "Requires the isolated Render preview server.",
);

const categories = [
  "Renders",
  "Policies & Guides",
  "Installation & Specification Sheets",
  "Wood Stain Chart",
  "Brochures & Catalogs",
  "Approved Logos",
  "Marketing Materials",
  "Direct Teamwork Access",
];
const announcementCategories = [
  "New Products",
  "Coming Soon",
  "New Policies",
  "Special Announcements",
  "Kessick Cut List",
  "Project Credits",
];

for (const width of [320, 375, 768, 1440]) {
  test(`cover and sections fit ${width}px without broken images or private requests`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const privateRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/"))
        privateRequests.push(request.url());
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Your Kessick project desk." }),
    ).toBeVisible();
    await expect(
      page.getByText("UNAPPROVED EXAMPLE · NOT REDEEMABLE"),
    ).toBeVisible();
    await expect(
      page.getByText("DESIGN CONCEPT · NOT AN APPROVED RELEASE"),
    ).toBeVisible();
    expect(
      await page
        .locator(".dealer-cover")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe("rgb(238, 237, 243)");
    await expect
      .poll(() =>
        page
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    expect(
      await page
        .locator(".desk-header")
        .evaluate((element) => getComputedStyle(element).backgroundImage),
    ).toContain("kessick-room-demo");
    await expect(page.locator(".desk-header img")).toHaveAttribute(
      "src",
      /kessick-logo-white/,
    );
    if (width === 375)
      await page.screenshot({
        path: "/tmp/kessick-dealer-cover-375.png",
        fullPage: true,
      });
    for (const section of [
      "home",
      "announcements",
      "design",
      "resources",
      "feedback",
      "account",
      "teamwork",
    ]) {
      await page.goto(`/#${section}`);
      await expect(page.locator("main")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
      await expect(page.getByText("Alex Morgan")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
    expect(privateRequests).toEqual([]);
  });
}

test("toolkit, profile, bell, bottom navigation and browser history work", async ({
  page,
}) => {
  await page.goto("/");
  const toolkit = page.locator(".desk-toolkit");
  for (const [label, heading] of [
    ["What’s New", "What’s New"],
    ["Design Request Form", "Design Request Form"],
    ["Dealer Resources", "Dealer Resources"],
    ["Feedback", "Report an Issue"],
  ]) {
    await toolkit.getByRole("link", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Project desk", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Your Kessick project desk.",
      }),
    ).toBeVisible();
  }
  await page
    .getByRole("link", { name: "Notifications and announcements" })
    .click();
  for (const name of announcementCategories)
    await expect(
      page.getByRole("heading", { level: 2, name, exact: true }),
    ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Your Kessick project desk." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Dealer profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Verified dealer access" }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Dealer navigation" });
  await nav.getByRole("link", { name: "Teamwork Account" }).click();
  await expect(
    page.getByRole("link", { name: "Open Teamwork sign-in" }),
  ).toHaveAttribute("href", "https://www.teamwork.com/login/");
  await expect(
    page.getByRole("link", { name: "Request Access" }),
  ).toHaveAttribute("href", /^mailto:sales@kessickwinecellars\.com\?/);
  await nav.getByRole("link", { name: "Dealer Account" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Dealer Account" }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Email Kessick" }),
  ).toHaveAttribute("href", "mailto:sales@kessickwinecellars.com");
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your Kessick project desk." }),
  ).toBeVisible();
  await page.locator(".desk-voucher").click();
  await expect(
    page.getByRole("heading", { name: "Special Announcements" }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await page.locator(".desk-feature").click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Coming Soon" }),
  ).toBeVisible();
});

test("search and filters return usable results and a clear empty state", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("textbox", { name: "Search dealer toolkit" });
  await search.fill("stain");
  await page
    .getByRole("region", { name: "Search results" })
    .getByRole("link", { name: /Wood Stain Chart/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Wood Stain Chart", exact: true }),
  ).toBeVisible();
  await search.fill("Forma");
  await page.getByRole("button", { name: "Filter search" }).click();
  await page.getByLabel("Search in", { exact: true }).selectOption("Design");
  await expect(
    page.getByRole("region", { name: "Search results" }).getByRole("link"),
  ).toHaveCount(1);
  await page
    .getByRole("region", { name: "Search results" })
    .getByRole("link", { name: /Forma/ })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Design Request Form" }),
  ).toBeVisible();
  await search.fill("no-such-material");
  await expect(
    page.getByText("No results. Try “Forma”, “stain” or “feedback”."),
  ).toBeVisible();
});

test("all resource categories have public links or genuine request-access actions", async ({
  page,
}) => {
  await page.goto("/#resources");
  for (const name of categories) {
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(card).toBeVisible();
    await expect(card.getByRole("link")).toHaveCount(1);
    expect(await card.getByRole("link").getAttribute("href")).toMatch(
      /^(https:\/\/(kessickwinecellars\.com|www\.teamwork\.com)\/|mailto:sales@kessickwinecellars\.com\?)/,
    );
  }
  await expect(page.locator("a[download]")).toHaveCount(0);
  await page.goto("/#design");
  await expect(
    page.getByRole("heading", { name: "Forma", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Towers", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open official Design Request Form" }),
  ).toHaveAttribute("href", "https://kessickwinecellars.com/design-request/");
  await expect(page.locator(".desk-checklist li")).toHaveCount(7);
  const links = await page
    .locator('a[target="_blank"]')
    .evaluateAll((anchors) =>
      anchors.map((anchor) => ({
        href: (anchor as HTMLAnchorElement).href,
        rel: (anchor as HTMLAnchorElement).rel,
      })),
    );
  for (const link of links) {
    expect(link.href).toMatch(/^https:\/\/kessickwinecellars\.com\//);
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
  }
});

test("feedback opens an encoded email draft, never claims submission, and supports telephone contact", async ({
  page,
}) => {
  await page.goto("/#feedback");
  await page.getByLabel("Issue category").selectOption("Document access");
  await page.getByLabel("Your name").fill("Preview Reviewer");
  await page.getByLabel("Dealer / company").fill("Example Cellars");
  await page.getByLabel("Reply email").fill("reviewer@example.test");
  await page
    .getByLabel("How can we help?")
    .fill("Please share the approved stain chart. & Thank you!");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await skip.focus();
  await skip.press("Enter");
  await expect(page).toHaveURL(/#feedback$/);
  await expect(page.locator("main")).toBeFocused();
  await expect(page.getByLabel("How can we help?")).toHaveValue(
    "Please share the approved stain chart. & Thank you!",
  );
  await page.getByRole("button", { name: "Open email draft" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Email draft requested — not sent.",
  );
  const href = await page
    .getByRole("link", { name: "open the prepared draft" })
    .getAttribute("href");
  const draft = new URL(href!);
  expect(draft.protocol).toBe("mailto:");
  expect(draft.pathname).toBe("sales@kessickwinecellars.com");
  expect(draft.searchParams.get("subject")).toContain("Document access");
  expect(draft.searchParams.get("body")).toContain("reviewer@example.test");
  expect(draft.searchParams.get("body")).toContain(
    "Please share the approved stain chart. & Thank you!",
  );
  await expect(
    page.getByRole("link", { name: "864.297.1911" }),
  ).toHaveAttribute("href", "tel:+18642971911");
  await expect(
    page.getByRole("link", { name: "Email Kessick", exact: true }).first(),
  ).toHaveAttribute("href", "mailto:sales@kessickwinecellars.com");
  await expect(page.getByText(/submitted successfully/i)).toHaveCount(0);
});

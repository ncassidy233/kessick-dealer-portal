import { expect, test } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111";
const initial = {
  schemaVersion: 1,
  title: "Dealer home",
  sections: [
    {
      id,
      type: "hero",
      background: "dark",
      spacing: "comfortable",
      heading: "Your Kessick project desk.",
      description: "Dealer support and resources.",
      alignment: "left",
      image: {
        url: "/kessick-headquarters-hero.webp",
        alt: "Kessick headquarters",
        fit: "cover",
        focalPoint: { x: 50, y: 50 },
      },
      actions: [{ label: "Design request", href: "/portal/forms" }],
    },
  ],
};

test("staff saves, previews at actual device widths, and explicitly publishes a server draft", async ({
  page,
}, testInfo) => {
  let draft = structuredClone(initial);
  let revision = 1;
  let published = 0;
  let publishes = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/bootstrap"))
      return route.fulfill({
        json: {
          role: "staff_admin",
          authorized: true,
          capabilities: ["content:read", "content:write", "pages:publish"],
          account: { id: "staff", status: "approved" },
          groups: [],
        },
      });
    if (url.pathname.endsWith("/history"))
      return route.fulfill({
        json: {
          history: published
            ? [
                {
                  revision: published,
                  publishedAt: new Date().toISOString(),
                  publishedByAccountId: "staff",
                },
              ]
            : [],
          publishedRevision: published,
        },
      });
    if (url.pathname.endsWith("/draft")) {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        expect(body.expectedRevision).toBe(revision);
        draft = body.document;
        revision++;
      }
      return route.fulfill({
        json: {
          draft: {
            document: draft,
            revision,
            updatedAt: new Date().toISOString(),
            updatedByAccountId: "staff",
          },
        },
      });
    }
    if (url.pathname.endsWith("/publish")) {
      const body = route.request().postDataJSON();
      expect(body.expectedDraftRevision).toBe(revision);
      expect(body.expectedPublishedRevision).toBe(published);
      published++;
      publishes++;
      return route.fulfill({
        json: { page: { revision: published, document: draft } },
      });
    }
    return route.fulfill({ status: 403, json: { error: "Unauthorized" } });
  });
  await page.goto("/admin/page-studio");
  await expect(
    page.getByRole("heading", { name: "Page Studio", exact: true }),
  ).toBeVisible();
  if (testInfo.project.name !== "desktop")
    await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Heading", { exact: true })
    .fill("Designed around your next project");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("All changes saved");
  await page.screenshot({
    path: testInfo.outputPath(
      `page-studio-editor-${testInfo.project.name}.png`,
    ),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  for (const [device, width] of [
    ["Mobile", 390],
    ["Tablet", 820],
    ["Desktop", 1440],
  ] as const) {
    await page.getByRole("button", { name: device, exact: true }).click();
    const frame = page.frameLocator(
      'iframe[title="Kessick draft device preview"]',
    );
    await expect(
      frame.getByRole("heading", { name: "Designed around your next project" }),
    ).toBeVisible();
    expect(
      await page
        .locator("iframe")
        .evaluate(
          (element: HTMLIFrameElement) => element.contentWindow!.innerWidth,
        ),
    ).toBe(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", {
      name:
        testInfo.project.name === "phone"
          ? "Mobile"
          : testInfo.project.name === "tablet"
            ? "Tablet"
            : "Desktop",
      exact: true,
    })
    .click();
  expect(publishes).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath(`page-studio-${testInfo.project.name}.png`),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(publishes).toBe(0);
  await page
    .getByRole("button", { name: "Confirm Publish", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Published to approved dealers",
  );
  expect(publishes).toBe(1);
});

test("content managers cannot publish and failed saves retain local edits", async ({
  page,
}, testInfo) => {
  let saves = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/bootstrap"))
      return route.fulfill({
        json: {
          role: "content_manager",
          authorized: true,
          capabilities: ["content:read", "content:write"],
          account: { id: "staff", status: "approved" },
          groups: [],
        },
      });
    if (url.pathname.endsWith("/history"))
      return route.fulfill({ json: { history: [], publishedRevision: 0 } });
    if (route.request().method() === "PUT") {
      saves++;
      return route.fulfill({
        status: 409,
        json: {
          error: "Another editor changed this draft. Reload before saving.",
        },
      });
    }
    return route.fulfill({
      json: { draft: { document: initial, revision: 1 } },
    });
  });
  await page.goto("/admin/page-studio");
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();
  if (testInfo.project.name !== "desktop")
    await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Heading", { exact: true })
    .fill("Keep my unsaved work");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Another editor");
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Keep my unsaved work",
  );
  expect(saves).toBe(1);
});

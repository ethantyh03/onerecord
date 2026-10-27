import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

/**
 * OneRecord golden path, driven through the /demo scene loader (storyboard §7.1).
 * Every scene resets the per-browser sandbox, so each test starts from a known state.
 */

type SceneId = "amy-intake" | "admin-marcus" | "marcus-dup" | "weijie-teams" | "priya-sap" | "pulse";

async function loadScene(page: Page, id: SceneId, expectPath: RegExp): Promise<void> {
  await page.goto("/demo");
  const btn = page.getByTestId(`scene-load-${id}`);
  await expect(btn).toBeVisible();
  await btn.click();
  await page.waitForURL(expectPath);
}

const tid = (id: string) => `[data-testid="${id}"]`;

test.describe("golden path", () => {
  test("(a) Amy: paste fills the item form, IVD rule adds QA/RA, licence required, submit", async ({ page }) => {
    await loadScene(page, "amy-intake", /\/requests\/new\?domain=item/);

    await page.getByTestId("paste-example-amy").click();
    await page.getByTestId("paste-apply").click();
    await expect(page.getByTestId("paste-result")).toBeVisible();
    await expect(page.getByTestId("paste-redactions")).toContainText(/sensitive value/i);

    // Fields filled from the email
    await expect(page.getByTestId("field-itemName")).toHaveValue(/K2EDTA/);
    await expect(page.getByTestId("field-category")).toHaveValue(/IVD medical device/);

    // Category → QA/RA joins the route, licence becomes required
    await expect(page.getByTestId("route-step-qa_ra")).toBeVisible();
    await expect(page.locator('label[for="fld-regLicenceNo"]')).toContainText("(required)");
    await expect(page.getByTestId("submit-request")).toBeDisabled();

    // Fill what is still needed
    const storage = page.getByTestId("field-storage");
    const firstOption = await storage.locator("option").nth(1).getAttribute("value");
    await storage.selectOption(firstOption ?? "");
    await page.getByTestId("field-regLicenceNo").fill("HSA-DE-0012345");
    await page.getByTestId("field-regCertificate-sample").click();

    await expect(page.getByTestId("expected-date")).toBeVisible();
    await expect(page.getByTestId("submit-request")).toBeEnabled();
    await page.getByTestId("submit-request").click();
    await expect(page.getByTestId("submit-success")).toBeVisible();
    await expect(page.getByTestId("success-linked")).toContainText("S$36,000");
  });

  test("(b) Marcus: duplicate check finds C-SG-00017 and he extends it", async ({ page }) => {
    await loadScene(page, "marcus-dup", /\/requests\/new\?draft=REQ-/);

    const panel = page.getByTestId("dup-panel").first();
    await expect(panel).toContainText("C-SG-00017", { timeout: 15_000 });
    await expect(panel).toContainText("National University Hospital");

    await page.getByTestId("dup-choice-extend").click();
    await expect(page.getByTestId("field-existingCode")).toHaveValue("C-SG-00017");
    await expect(page.getByTestId("request-type-extend")).toHaveAttribute("aria-checked", "true");
  });

  test("(c) Wei Jie: approves the extension on the Teams card", async ({ page }) => {
    await loadScene(page, "weijie-teams", /\/approvals/);

    const item = page.locator('[data-testid^="waiting-item-REQ-1100"]');
    await expect(item).toBeVisible();
    await item.click();

    const card = page.getByTestId("teams-card");
    await expect(card).toBeVisible();
    await expect(card.getByTestId("teams-masked").first()).toBeVisible();
    await card.getByTestId("teams-approve").click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /Approved/ })).toBeVisible();

    // Finance is done; the request advances to MLS's own extra step (added in Admin), then MDM.
    await expect(page.locator('[data-testid^="waiting-item-REQ-1100"]')).toHaveCount(0);
    await page.goto("/requests/view?id=REQ-1100");
    await expect(page.getByTestId("tracker-timeline")).toBeVisible();
    await expect(page.locator('[data-testid^="tracker-step-"][data-testid*="ext-fin"]').first()).toHaveAttribute(
      "data-status",
      "approved",
    );
    await expect(page.locator('[data-testid^="tracker-step-mls-regulatory"]')).toHaveAttribute("data-status", "pending");
    await expect(page.locator(tid("tracker-mdm"))).toHaveAttribute("data-state", "upcoming");
  });

  test("(d) Priya: generates the DTW import, marks it created, stuck demand drops", async ({ page }) => {
    await loadScene(page, "priya-sap", /\/mdm\?id=REQ-1100/);

    const value = page.getByTestId("stuck-demand-value");
    await expect(value).toBeVisible();
    const before = Number(await value.getAttribute("data-value"));
    expect(before).toBeGreaterThan(0);

    await page.getByTestId("mdm-generate-dtw").click();
    await expect(page.getByTestId("mdm-dtw-preview")).toBeVisible();
    await expect(page.getByTestId("mdm-dtw-preview")).toContainText("ItemCode");

    await page.getByTestId("mdm-mark-created").click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /created/i }).first()).toBeVisible();

    await expect
      .poll(async () => Number(await page.getByTestId("stuck-demand-value").getAttribute("data-value")))
      .toBeLessThan(before);
    const after = Number(await page.getByTestId("stuck-demand-value").getAttribute("data-value"));
    expect(before - after).toBe(36_000);
  });

  test("(e) Regional Pulse: matrix, hero and forecast render; merged/raw toggle", async ({ page }) => {
    await loadScene(page, "pulse", /\/pulse/);

    await expect(page.getByTestId("pulse-matrix")).toBeVisible();
    await expect(page.getByTestId("pulse-cell-SG-A")).toBeVisible();
    await expect(page.getByTestId("pulse-hero")).toBeVisible();
    await expect(page.getByTestId("forecast-panel")).toBeVisible();

    await expect(page.getByTestId("pulse-hero")).toHaveAttribute("data-view", "merged");
    await page.getByTestId("pulse-toggle-raw").click();
    await expect(page.getByTestId("pulse-hero")).toHaveAttribute("data-view", "raw");
    await page.getByTestId("pulse-toggle-merged").click();
    await expect(page.getByTestId("pulse-hero")).toHaveAttribute("data-view", "merged");
    await expect(page.getByTestId("pulse-hero-golden")).toBeVisible();
  });
});

// ------------------------------------------------------------------------------------------------
// Smoke: every route renders with no console errors or uncaught exceptions
// ------------------------------------------------------------------------------------------------

const ROUTES = [
  "/",
  "/requests/new",
  "/requests",
  "/requests/view?id=REQ-1042",
  "/approvals",
  "/mdm",
  "/mdm?id=REQ-1042",
  "/sap",
  "/pulse",
  "/assumptions",
  "/triage",
  "/impact",
  "/architecture",
  "/scope",
  "/admin",
  "/demo",
  "/pitch/hook?still=1",
  "/pitch/close",
];

const IGNORED_CONSOLE = [/Download the React DevTools/i, /favicon/i];

test.describe("smoke: routes render without console errors", () => {
  for (const route of ROUTES) {
    test(`route ${route}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg: ConsoleMessage) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
        errors.push(text);
      });
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

      const res = await page.goto(route);
      expect(res?.status() ?? 0).toBeLessThan(400);
      await expect(page.locator("#main, [data-testid='pitch-overlay']").first()).toBeVisible();
      await page.waitForTimeout(800);
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("nav links all resolve", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main")).toBeVisible();
    const hrefs = await page.locator("aside nav a[href^='/']").evaluateAll((as) =>
      Array.from(new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""))),
    );
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), href).toBeLessThan(400);
    }
  });
});

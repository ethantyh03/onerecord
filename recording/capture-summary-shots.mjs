// Captures the three small screenshots used on /pitch/summary slide 1 from the live build.
// Usage: node recording/capture-summary-shots.mjs [baseUrl]   (default http://localhost:3100)
// Writes public/summary/{dup,teams,pulse}.png (element crops at 2x).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = path.join(ROOT, "public", "summary");
mkdirSync(OUT, { recursive: true });

const BANNED = /Sunway|Penang General|Siriraj|KPJ|Vinmec/i;

async function loadScene(page, id) {
  await page.goto(`${BASE}/demo`);
  await page.getByTestId(`scene-load-${id}`).click();
  await page.waitForLoadState("networkidle");
}

async function checkNames(page, label) {
  const text = await page.locator("body").innerText();
  const m = text.match(BANNED);
  if (m) throw new Error(`Real hospital name "${m[0]}" visible on ${label}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await ctx.newPage();
try {
  // 1. Duplicate catch (Marcus)
  await loadScene(page, "marcus-dup");
  const panel = page.getByTestId("dup-panel").first();
  await panel.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => document.body.innerText.includes("C-SG-00017"), null, { timeout: 15_000 });
  await page.waitForTimeout(600);
  await checkNames(page, "marcus-dup");
  await panel.screenshot({ path: path.join(OUT, "dup.png") });

  // 2. Teams card (Wei Jie)
  await loadScene(page, "weijie-teams");
  const card = page.getByTestId("teams-card");
  if (!(await card.isVisible().catch(() => false))) {
    await page.locator('[data-testid^="waiting-item-REQ-1101"]').click();
  }
  await card.waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  await checkNames(page, "weijie-teams");
  await card.screenshot({ path: path.join(OUT, "teams.png") });

  // 3. Regional Pulse hero, merged (Bukit Damai #2, −32%)
  await loadScene(page, "pulse");
  const hero = page.getByTestId("pulse-hero");
  await hero.waitFor({ state: "visible" });
  await page.getByTestId("pulse-toggle-merged").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="pulse-hero"]')?.getAttribute("data-view") === "merged");
  await page.waitForTimeout(2500);
  await checkNames(page, "pulse");
  await hero.screenshot({ path: path.join(OUT, "pulse.png") });
  console.log("wrote", OUT);
} finally {
  await browser.close();
}

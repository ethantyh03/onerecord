// Exploration helper: node recording/tools/explore.mjs <name> <scene|-> <path|-> [fullPage]
import { chromium } from "@playwright/test";
const [name, scene, path, full] = process.argv.slice(2);
const BASE = "http://localhost:3100";
const OUT = "deliverables/video/explore";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
if (scene && scene !== "-") {
  await page.goto(BASE + "/demo");
  await page.getByTestId(`scene-load-${scene}`).click();
  await page.waitForTimeout(2500);
}
if (path && path !== "-") { await page.goto(BASE + path); await page.waitForTimeout(2500); }
console.log("URL", page.url());
await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full === "full" });
const ids = await page.evaluate(() => [...document.querySelectorAll("[data-testid]")].map(e => { const r = e.getBoundingClientRect(); return `${e.dataset.testid} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} ${e.tagName} "${(e.textContent||"").trim().slice(0,50).replace(/\s+/g," ")}"`; }));
console.log(ids.join("\n"));
const bad = await page.evaluate(() => /Sunway|Penang General|Siriraj|KPJ|Vinmec/.test(document.body.innerText));
console.log("BADNAMES", bad);
await browser.close();

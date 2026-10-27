// node recording/tools/probe.mjs <stepsFile.mjs>  — steps file exports default async (page, shot, dump)
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
const BASE = "http://localhost:3100";
const OUT = "deliverables/video/explore";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25, baseURL: BASE });
const page = await ctx.newPage();
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const dump = async (filter) => console.log((await page.evaluate((f) => [...document.querySelectorAll("[data-testid]")].filter(e=>!f||e.dataset.testid.includes(f)).map(e => { const r = e.getBoundingClientRect(); return `${e.dataset.testid} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} "${(e.textContent||"").trim().slice(0,60).replace(/\s+/g," ")}"`; }), filter)).join("\n"));
const loadScene = async (id) => { await page.goto("/demo"); await page.getByTestId(`scene-load-${id}`).click(); await page.waitForTimeout(2000); };
try {
  const mod = await import(pathToFileURL(process.argv[2]).href);
  await mod.default({ page, shot, dump, loadScene });
} catch (e) { console.error("ERR", e.message); await shot("err"); }
const bad = await page.evaluate(() => /Sunway|Penang General|Siriraj|KPJ|Vinmec/.test(document.body.innerText));
console.log("BADNAMES", bad);
await browser.close();

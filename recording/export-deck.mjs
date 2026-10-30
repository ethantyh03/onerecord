// Exports the finals deck (/deck?print=1) to deliverables/finals/:
//   Tesseract-finals-deck.pdf (one 1920×1080 page per slide, end state of every transition) + slides/NN.png.
// Usage: node recording/export-deck.mjs [baseUrl]   (default http://localhost:3200)
// The dev server must be running; nothing else depends on this script.
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.argv[2] ?? "http://localhost:3200").replace(/\/$/, "");
const OUT = path.join(ROOT, "deliverables", "finals");
const SLIDES_DIR = path.join(OUT, "slides");
mkdirSync(SLIDES_DIR, { recursive: true });
for (const f of readdirSync(SLIDES_DIR)) if (f.endsWith(".png")) rmSync(path.join(SLIDES_DIR, f));

// No real hospital or company names, and no unfilled links, on any slide.
const BANNED = /Sunway|Penang General|Siriraj|KPJ|Vinmec|National University Hospital|Natl Univ Hosp|REPLACE_ME/i;

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.warn("page error:", e.message));
  const res = await page.goto(`${BASE}/deck?print=1`, { waitUntil: "networkidle", timeout: 180_000 });
  if (!res || res.status() >= 400) throw new Error(`/deck?print=1 returned ${res?.status()}`);
  await page.waitForSelector("[data-deck-print][data-ready='1']", { timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  // The demo-handoff slide frames the live app: let the iframe finish loading and settle.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);

  const slides = page.locator("[data-print-slide]");
  const n = await slides.count();
  if (n === 0) throw new Error("No slides rendered");

  const text = await page.locator("[data-deck-print]").innerText();
  const bad = text.match(BANNED);
  if (bad) throw new Error(`Forbidden text on a slide: "${bad[0]}"`);

  // Overflow check: nothing may spill outside a slide.
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-print-slide]")).map((s) => {
      const box = s.getBoundingClientRect();
      const out = [];
      s.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        // The title wordmark bleeds off the bottom edge on purpose (like the Gotham site).
        if (getComputedStyle(el).visibility === "hidden" || el.closest("[data-bleed]")) return;
        if (r.right > box.right + 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1)
          out.push(`${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 40)}"`);
      });
      return { label: s.getAttribute("data-print-slide"), out: out.slice(0, 4) };
    }),
  );
  for (const o of overflow) if (o.out.length) console.warn(`slide ${o.label} spills over its edge:`, o.out);

  for (let i = 0; i < n; i++) {
    const label = await slides.nth(i).getAttribute("data-print-slide");
    const name = /^\d+$/.test(label) ? label.padStart(2, "0") : label;
    await slides.nth(i).screenshot({ path: path.join(SLIDES_DIR, `${name}.png`) });
  }

  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: path.join(OUT, "Tesseract-finals-deck.pdf"),
    width: "1920px",
    height: "1080px",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
    preferCSSPageSize: true,
  });
  console.log(`wrote ${n} slides to ${OUT}`);
} finally {
  await browser.close();
}

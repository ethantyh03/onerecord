// Exports /pitch/summary to deliverables/summary/: OneRecord-summary.pdf (2 pages, 1920×1080) + slide-1.png, slide-2.png.
// Usage: node recording/export-summary.mjs [baseUrl]   (default http://localhost:3100)
// Re-run after changing LINKS (src/lib/links.ts) and rebuilding; nothing else depends on it.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = path.join(ROOT, "deliverables", "summary");
mkdirSync(OUT, { recursive: true });

const BANNED = /Sunway|Penang General|Siriraj|KPJ|Vinmec|REPLACE_ME/i;

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 2000, height: 1200 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}/pitch/summary`, { waitUntil: "networkidle" });
  if (!res || res.status() >= 400) throw new Error(`/pitch/summary returned ${res?.status()}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0));

  const text = await page.locator('[data-testid="pitch-summary"]').innerText();
  const bad = text.match(BANNED);
  if (bad) throw new Error(`Forbidden text on the summary: "${bad[0]}"`);
  const team = await page.getByTestId("summary-team").first().innerText().catch(() => "");
  if (!team.includes("·")) console.warn("! TEAM NAME MISSING: set TEAM_NAME in src/app/pitch/summary/page.tsx, rebuild, and re-export (final model §7.4).");

  // Overflow check: nothing may spill outside a slide.
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".summary-slide")).map((s) => {
      const box = s.getBoundingClientRect();
      const out = [];
      s.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > box.right + 0.5 || r.bottom > box.bottom + 0.5)) out.push(`${el.tagName}.${String(el.className).slice(0, 40)}`);
      });
      return { scrollH: s.scrollHeight, clientH: s.clientHeight, out: out.slice(0, 5) };
    }),
  );
  overflow.forEach((o, i) => {
    if (o.scrollH > o.clientH || o.out.length) console.warn(`slide ${i + 1} overflows:`, o);
  });

  for (const n of [1, 2]) {
    await page.getByTestId(`summary-slide-${n}`).screenshot({ path: path.join(OUT, `slide-${n}.png`) });
  }

  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: path.join(OUT, "OneRecord-summary.pdf"),
    width: "1920px",
    height: "1080px",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
    preferCSSPageSize: true,
  });
  console.log("wrote", OUT);
} finally {
  await browser.close();
}

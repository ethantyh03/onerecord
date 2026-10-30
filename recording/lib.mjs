// Recording harness: CDP screencast capture on a virtual clock, injected cursor + caption overlay,
// paced actions, and per-beat encoding with ffmpeg. Used by record.mjs; beat scripts live in beats.mjs.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BASE = process.env.TESSERACT_URL || "http://localhost:3100";
export const FFBIN =
  "C:/Users/ethan/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin";
export const FFMPEG = `${FFBIN}/ffmpeg.exe`;
export const FFPROBE = `${FFBIN}/ffprobe.exe`;
export const OUT = process.env.REC_OUT ? path.resolve(process.env.REC_OUT) : path.join(ROOT, "deliverables", "video");
export const VIEWPORT = { width: 1536, height: 864 };
export const DSF = 1.25;
export const FPS = 30;

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// ---------------------------------------------------------------------------------------------
// Overlay injected into every document: cursor dot + click ripple, caption pill, repaint "tick".
// ---------------------------------------------------------------------------------------------
export const OVERLAY = () => {
  if (window.__recInit) return;
  window.__recInit = true;
  const css = `
  #__rec_cursor{position:fixed;left:0;top:0;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;
    background:rgba(15,23,42,.62);border:2.5px solid #fff;box-shadow:0 0 0 1.5px rgba(15,23,42,.5),0 3px 10px rgba(0,0,0,.28);
    z-index:2147483647;pointer-events:none;will-change:transform;transform:translate(-100px,-100px)}
  .__rec_ripple{position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;
    border:3px solid rgba(20,184,166,.95);z-index:2147483646;pointer-events:none;animation:__recrip .6s ease-out forwards}
  @keyframes __recrip{from{transform:var(--p) scale(.5);opacity:1}to{transform:var(--p) scale(3.6);opacity:0}}
  #__rec_capwrap{position:fixed;left:var(--cap-left,0px);right:var(--cap-right,0px);bottom:var(--cap-bottom,22px);
    display:flex;justify-content:center;z-index:2147483645;pointer-events:none}
  #__rec_cap{max-width:var(--cap-max,900px);background:rgba(8,13,22,.82);color:#fff;font-family:inherit;font-weight:600;
    font-size:23px;line-height:1.36;padding:9px 24px 10px;border-radius:24px;text-align:center;
    box-shadow:0 6px 24px rgba(0,0,0,.30);opacity:0;transition:opacity .16s ease}
  #__rec_cap.on{opacity:1}
  #__rec_tick{position:fixed;right:0;bottom:0;width:2px;height:2px;z-index:2147483647;pointer-events:none;opacity:.03;background:#000}
  .animate-spin{visibility:hidden !important}
  `;
  const state = { x: -100, y: -100 };
  const ensure = () => {
    if (!document.body) return null;
    let c = document.getElementById("__rec_cursor");
    if (!c) {
      const st = document.createElement("style");
      st.id = "__rec_style";
      st.textContent = css;
      document.head.appendChild(st);
      c = document.createElement("div");
      c.id = "__rec_cursor";
      const w = document.createElement("div");
      w.id = "__rec_capwrap";
      const cap = document.createElement("div");
      cap.id = "__rec_cap";
      w.appendChild(cap);
      const t = document.createElement("div");
      t.id = "__rec_tick";
      document.body.append(c, w, t);
    }
    return c;
  };
  const place = () => {
    const c = ensure();
    if (c) c.style.transform = `translate(${state.x}px,${state.y}px)`;
  };
  document.addEventListener("mousemove", (e) => { state.x = e.clientX; state.y = e.clientY; place(); }, true);
  const ripple = (x, y) => {
    if (!document.body) return;
    const r = document.createElement("div");
    r.className = "__rec_ripple";
    r.style.setProperty("--p", `translate(${x}px,${y}px)`);
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 700);
  };
  document.addEventListener("mousedown", (e) => ripple(e.clientX, e.clientY), true);
  window.__recRipple = ripple;
  window.__recSetCursor = (x, y) => { state.x = x; state.y = y; place(); };
  window.__recCaption = (text) => {
    ensure();
    const cap = document.getElementById("__rec_cap");
    if (!cap) return;
    if (text) { cap.textContent = text; cap.classList.add("on"); } else cap.classList.remove("on");
  };
  window.__recTick = () => {
    ensure();
    const t = document.getElementById("__rec_tick");
    if (t) t.style.background = t.style.background === "rgb(255, 255, 255)" ? "#000" : "#fff";
  };
  window.__recConfig = (cfg) => {
    ensure();
    const root = document.documentElement.style;
    root.setProperty("--cap-left", `${cfg.capLeft ?? 0}px`);
    root.setProperty("--cap-right", `${cfg.capRight ?? 0}px`);
    root.setProperty("--cap-bottom", `${cfg.capBottom ?? 22}px`);
    root.setProperty("--cap-max", `${cfg.capMax ?? 900}px`);
    const c = document.getElementById("__rec_cursor");
    if (c) c.style.display = cfg.cursor === false ? "none" : "block";
  };
  const boot = () => { ensure(); place(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  // React may re-render <body> children on hydration; re-ensure periodically.
  setInterval(() => { if (!document.getElementById("__rec_cursor")) boot(); }, 250);
};

// ---------------------------------------------------------------------------------------------
// Captions: sentence cues from the edge-tts .srt, optional display text, long cues split.
// ---------------------------------------------------------------------------------------------
function parseSrt(text) {
  const cues = [];
  const t = (s) => { const [h, m, rest] = s.split(":"); const [sec, ms] = rest.split(","); return +h * 3600 + +m * 60 + +sec + +ms / 1000; };
  for (const block of text.replace(/\r/g, "").split(/\n\n+/)) {
    const lines = block.trim().split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->").map((s) => t(s.trim()));
    cues.push({ start: a, end: b, text: lines.slice(i + 1).join(" ").trim() });
  }
  return cues;
}

function splitLong(text, max = 112) {
  if (text.length <= max) return [text];
  const parts = Math.ceil(text.length / max);
  const target = text.length / parts;
  const out = [];
  let rest = text;
  for (let k = parts; k > 1; k--) {
    const goal = rest.length / k;
    let best = -1, bestD = Infinity;
    const re = /[,:;](?=\s)|\s(?=and |so |but |with |where |then )/g;
    let m;
    while ((m = re.exec(rest))) {
      const cut = m.index + (m[0].trim() ? 1 : 0);
      const d = Math.abs(cut - goal);
      if (d < bestD && cut > 12 && rest.length - cut > 12) { best = cut; bestD = d; }
    }
    if (best < 0 || bestD > target * 0.6) {
      best = rest.lastIndexOf(" ", Math.round(goal));
      if (best < 12) best = rest.indexOf(" ", Math.round(goal));
    }
    out.push(rest.slice(0, best).trim());
    rest = rest.slice(best).trim();
  }
  out.push(rest);
  return out;
}

/** Caption chunks for a beat, in beat-local seconds (VO offset applied). */
export function captionChunks(sbBeat, voOffset, duration) {
  const srtPath = path.join(OUT, "vo", `${sbBeat.id}.srt`);
  const cues = parseSrt(fs.readFileSync(srtPath, "utf8"));
  const disp = Array.isArray(sbBeat.captions) && sbBeat.captions.length === cues.length ? sbBeat.captions : null;
  const chunks = [];
  cues.forEach((c, i) => {
    const text = disp ? disp[i] : c.text;
    const pieces = splitLong(text);
    const total = pieces.reduce((a, p) => a + p.length, 0);
    let t = c.start;
    for (const p of pieces) {
      const d = (c.end - c.start) * (p.length / total);
      chunks.push({ start: voOffset + t, end: voOffset + t + d, text: p });
      t += d;
    }
  });
  // Merge tiny trailing cues (e.g. "One hospital." / "One record.") are kept; extend each chunk to the next start.
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    chunks[i].showUntil = next ? next.start : Math.min(duration - 0.15, chunks[i].end + 1.2);
  }
  chunks[0].start = Math.max(0, chunks[0].start - 0.1);
  return chunks;
}

// ---------------------------------------------------------------------------------------------
// Recorder
// ---------------------------------------------------------------------------------------------
export class Rec {
  constructor(page, context, id, cfg) {
    this.page = page;
    this.context = context;
    this.id = id;
    this.cfg = cfg; // {voOffset, duration, cursor, capLeft, capRight, capBottom, capMax}
    this.frames = [];
    this.recording = false;
    this.paused = false;
    this.pausedMs = 0;
    this.pauses = [];
    this.resumeWall = 0;
    this.mx = 760;
    this.my = 520;
    this.shownCaption = null;
    this.frameDir = path.join(OUT, "_frames", id);
    fs.rmSync(this.frameDir, { recursive: true, force: true });
    fs.mkdirSync(this.frameDir, { recursive: true });
    this.log = [];
  }

  vt() { return (Date.now() - this.t0 - this.pausedMs) / 1000; }
  async until(t) { while (this.vt() < t) await sleep(Math.min(20, (t - this.vt()) * 1000)); }
  async at(t) {
    const late = this.vt() - t;
    if (late > 0.35) this.log.push(`late by ${late.toFixed(2)}s for action at ${t}s`);
    await this.until(t);
  }

  async applyOverlay() {
    const { cursor, capLeft, capRight, capBottom, capMax } = this.cfg;
    await this.page.evaluate(
      ([cfg, x, y, cap]) => {
        window.__recConfig?.(cfg);
        window.__recSetCursor?.(x, y);
        window.__recCaption?.(cap);
        window.__recTick?.();
      },
      [{ cursor, capLeft, capRight, capBottom, capMax }, this.mx, this.my, this.shownCaption || ""],
    ).catch(() => {});
  }

  async settle(extraMs = 500) {
    await this.page.waitForLoadState("load").catch(() => {});
    await this.page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await this.page.evaluate(() => document.fonts.ready).catch(() => {});
    await sleep(extraMs);
  }

  async start() {
    this.cdp = await this.context.newCDPSession(this.page);
    let n = 0;
    this.cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      const wall = metadata.timestamp * 1000;
      if (this.recording && !this.paused && wall >= this.resumeWall) {
        const file = path.join(this.frameDir, `f${String(++n).padStart(6, "0")}.jpg`);
        fs.writeFileSync(file, Buffer.from(data, "base64"));
        this.frames.push({ file, wall });
      }
      this.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await this.applyOverlay();
    this.t0 = Date.now();
    this.resumeWall = this.t0;
    this.recording = true;
    this.chunks = captionChunks(this.cfg.sbBeat, this.cfg.voOffset, this.cfg.duration);
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    await this.page.evaluate(() => window.__recTick?.()).catch(() => {});
    this.capTimer = setInterval(() => this.updateCaption(), 40);
    this.updateCaption();
  }

  updateCaption() {
    if (!this.recording || this.paused) return;
    const t = this.vt();
    const c = this.chunks.find((k) => t >= k.start && t < k.showUntil);
    const text = process.env.NO_CAPTIONS ? "" : (c ? c.text : "");
    if (text === (this.shownCaption || "")) return;
    this.shownCaption = text;
    this.page.evaluate((s) => { window.__recCaption?.(s); return !!window.__recCaption && !!document.getElementById("__rec_cap"); }, text).then((ok) => process.env.DEBUG_CAP && console.log("cap", this.vt().toFixed(2), ok, text.slice(0, 30))).catch((e) => process.env.DEBUG_CAP && console.log("caperr", e.message));
  }

  /** Hide whatever fn does (navigation, scene loads) from the capture; the virtual clock stops meanwhile. */
  async cut(fn) {
    this.paused = true;
    const p0 = Date.now();
    await fn();
    await this.settle(600);
    await this.applyOverlay();
    const p1 = Date.now();
    this.pausedMs += p1 - p0;
    this.pauses.push([p0, p1]);
    const before = this.frames.length;
    this.resumeWall = p1;
    this.paused = false;
    this.updateCaption();
    for (let i = 0; i < 10 && this.frames.length === before; i++) {
      await this.page.evaluate(() => window.__recTick?.()).catch(() => {});
      await sleep(30);
    }
  }

  async stop() {
    await this.until(this.cfg.duration + 0.05);
    clearInterval(this.capTimer);
    this.recording = false;
    await this.cdp.send("Page.stopScreencast").catch(() => {});
  }

  // ----- pointer & page actions -------------------------------------------------------------
  async moveTo(x, y, ms = 650) {
    const x0 = this.mx, y0 = this.my;
    const t0 = Date.now();
    const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    for (;;) {
      const p = Math.min(1, (Date.now() - t0) / ms);
      const e = ease(p);
      this.mx = x0 + (x - x0) * e;
      this.my = y0 + (y - y0) * e;
      await this.page.mouse.move(this.mx, this.my);
      if (p >= 1) break;
      await sleep(12);
    }
  }

  async box(target) {
    const loc = typeof target === "string" ? this.page.locator(target).filter({ visible: true }).first() : target;
    await loc.waitFor({ state: "visible", timeout: 10000 });
    return loc.boundingBox();
  }

  /** Bring an element into a comfortable band of the viewport with a smooth scroll (if needed). */
  async reveal(target, { top = 110, bottom = 130, ms = 800, at = null, skip = false } = {}) {
    if (skip) return;
    const b = await this.box(target);
    const vh = VIEWPORT.height;
    let dy = 0;
    if (at !== null) dy = b.y - at;
    else if (b.y < top) dy = b.y - top;
    else if (b.y + b.height > vh - bottom) dy = b.y + b.height - (vh - bottom);
    if (Math.abs(dy) > 2) await this.scrollBy(dy, ms);
  }

  async scrollBy(dy, ms = 800) {
    await this.page.evaluate(
      ([dy, ms]) =>
        new Promise((res) => {
          const y0 = window.scrollY;
          const t0 = performance.now();
          const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
          const step = (t) => {
            const p = Math.min(1, (t - t0) / ms);
            window.scrollTo(0, y0 + dy * ease(p));
            if (p < 1) requestAnimationFrame(step);
            else res();
          };
          requestAnimationFrame(step);
        }),
      [dy, ms],
    );
  }

  async scrollTo(y, ms = 800) {
    const cur = await this.page.evaluate(() => window.scrollY);
    await this.scrollBy(y - cur, ms);
  }

  async hover(target, { ms = 650, dx = 0, dy = 0, fx = 0.5, fy = 0.5 } = {}) {
    const b = await this.box(target);
    await this.moveTo(b.x + b.width * fx + dx, b.y + b.height * fy + dy, ms);
  }

  async click(target, { ms = 650, pause = 140, fx = 0.5, fy = 0.5, dx = 0, dy = 0, revealOpts = { top: 84, bottom: 12 } } = {}) {
    await this.reveal(target, revealOpts);
    const b = await this.box(target);
    await this.moveTo(b.x + b.width * fx + dx, b.y + b.height * fy + dy, ms);
    await sleep(pause);
    await this.page.mouse.down();
    await sleep(70);
    await this.page.mouse.up();
  }

  async type(target, text, { delay = 50, clear = false } = {}) {
    await this.click(target);
    if (clear) {
      await this.page.keyboard.press("Control+a");
      await sleep(120);
      await this.page.keyboard.press("Backspace");
      await sleep(250);
    }
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await sleep(delay + Math.round((Math.random() - 0.5) * 16));
    }
  }

  async select(target, valueOrIndex) {
    const loc = typeof target === "string" ? this.page.locator(target).first() : target;
    await this.reveal(loc, { bottom: 190 });
    const b = await this.box(loc);
    await this.moveTo(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await sleep(120);
    await this.page.evaluate(([x, y]) => window.__recRipple?.(x, y), [this.mx, this.my]);
    let value = valueOrIndex;
    if (typeof valueOrIndex === "number") value = await loc.locator("option").nth(valueOrIndex).getAttribute("value");
    await loc.selectOption(value);
  }

  // ----- encoding -----------------------------------------------------------------------------
  pausedBefore(wall) {
    let s = 0;
    for (const [a, b] of this.pauses) if (b <= wall) s += b - a;
    return s;
  }

  encode() {
    const D = this.cfg.duration;
    const fr = this.frames
      .map((f) => ({ file: f.file, v: Math.max(0, (f.wall - this.t0 - this.pausedBefore(f.wall)) / 1000) }))
      .filter((f) => f.v < D)
      .sort((a, b) => a.v - b.v);
    if (!fr.length) throw new Error(`${this.id}: no frames captured`);
    fr[0].v = 0;
    const lines = ["ffconcat version 1.0"];
    for (let i = 0; i < fr.length; i++) {
      const next = i + 1 < fr.length ? fr[i + 1].v : D;
      const d = Math.max(0.001, next - fr[i].v);
      lines.push(`file '${fr[i].file.replace(/\\/g, "/")}'`, `duration ${d.toFixed(4)}`);
    }
    lines.push(`file '${fr[fr.length - 1].file.replace(/\\/g, "/")}'`);
    const list = path.join(this.frameDir, "list.ffconcat");
    fs.writeFileSync(list, lines.join("\n") + "\n");
    const outDir = path.join(OUT, "beats");
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `${this.id}.mp4`);
    const args = [
      "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list,
      "-vf", `scale=1920:1080:flags=lanczos,fps=${FPS},format=yuv420p`,
      "-t", D.toFixed(3), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "17",
      "-movflags", "+faststart", out,
    ];
    const r = spawnSync(FFMPEG, args, { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`${this.id}: ffmpeg failed`);
    const meta = { id: this.id, duration: D, voOffset: this.cfg.voOffset, frames: fr.length, log: this.log, recordedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(outDir, `${this.id}.json`), JSON.stringify(meta, null, 2));
    if (!process.env.KEEP_FRAMES) fs.rmSync(this.frameDir, { recursive: true, force: true });
    return meta;
  }
}

export async function recordBeat(def, sbBeat) {
  const duration = +(def.voOffset + sbBeat.voSeconds + def.tail).toFixed(2);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DSF, baseURL: BASE });
    await context.addInitScript(OVERLAY);
    const page = await context.newPage();
    const cfg = {
      sbBeat, voOffset: def.voOffset, duration, cursor: def.cursor !== false,
      capLeft: def.capLeft ?? 248, capRight: def.capRight ?? 400, capBottom: def.capBottom ?? 20, capMax: def.capMax ?? 880,
    };
    const r = new Rec(page, context, sbBeat.id, cfg);
    await def.setup(r);
    if (!def.noSettle) await r.settle(def.settleMs ?? 700);
    if (def.startMouse) { r.mx = def.startMouse[0]; r.my = def.startMouse[1]; }
    await page.mouse.move(r.mx, r.my);
    await r.start();
    await def.run(r);
    await r.stop();
    const bad = await page.evaluate(() => /Sunway|Penang General|Siriraj|KPJ|Vinmec/.test(document.body.innerText)).catch(() => false);
    if (bad) r.log.push("REAL HOSPITAL NAME ON SCREEN");
    await context.close();
    const meta = r.encode();
    return meta;
  } finally {
    await browser.close();
  }
}

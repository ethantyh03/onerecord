"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimate, useReducedMotion, type Variants } from "motion/react";
import { loadScene } from "@/lib/scenes";
import { cn } from "@/lib/utils";
import { STAGE_H, STAGE_W } from "./primitives";
import { CHECKPOINTS, DEMO_BEATS, MAIN_COUNT, SLIDES, clockToSeconds } from "./slides-config";
import { DEMO_ROUTE } from "./slides/handoff";
import { SlideThumb, SlideView } from "./slide-view";
import { useViewport } from "./use-viewport";

const LAST_MAIN = MAIN_COUNT - 1;
const HANDOFF_INDEX = SLIDES.findIndex((s) => s.id === "s08-demo-handoff");
const RETURN_INDEX = SLIDES.findIndex((s) => s.id === "s09-regional");
const TIMER_KEY = "tesseract-deck-timer";
const CHANNEL = "tesseract-deck";

/** Every slide change is a 180 ms cross-fade, or a cut where the next slide's first frame continues this one. */
const FADE: Variants = {
  enter: (cut: boolean) => ({ opacity: cut ? 1 : 0 }),
  center: (cut: boolean) => ({ opacity: 1, transition: { duration: cut ? 0 : 0.18 } }),
  exit: (cut: boolean) => ({ opacity: 0, transition: { duration: cut ? 0 : 0.18 } }),
};

// ---------------------------------------------------------------- hash <-> index

export function indexFromHash(hash: string): number | null {
  const h = hash.replace(/^#/, "").trim().toLowerCase();
  if (!h) return null;
  const a = /^a(\d{1,2})$/.exec(h);
  if (a) {
    const i = SLIDES.findIndex((s) => s.label.toLowerCase() === `a${Number(a[1])}`);
    return i >= 0 ? i : null;
  }
  const n = Number(h);
  if (Number.isInteger(n) && n >= 1 && n <= MAIN_COUNT) return n - 1;
  const byId = SLIDES.findIndex((s) => s.id === h);
  return byId >= 0 ? byId : null;
}

function hashOf(index: number): string {
  return `#${SLIDES[index].label}`;
}

// ---------------------------------------------------------------- talk timer (shared by every window, survives the demo)

function readTimer(): number | null {
  try {
    const v = Number(window.localStorage.getItem(TIMER_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
function writeTimer(v: number | null) {
  try {
    if (v === null) window.localStorage.removeItem(TIMER_KEY);
    else window.localStorage.setItem(TIMER_KEY, String(v));
  } catch {
    /* storage unavailable: the timer lives for this page only */
  }
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function useNow(ms = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

// ---------------------------------------------------------------- state

interface DeckState {
  index: number;
  step: number;
  /** Play the slide's build or signature transition on this arrival. */
  play: boolean;
  /** Bumped on every navigation, so a slide re-mounts (and replays) when re-entered. */
  nonce: number;
  /** Cut (no cross-fade) into this slide: its first frame continues the previous one. */
  cut: boolean;
}

/**
 * `at`: when the sender last navigated (shared clock: every window is on this machine). `to`: a reply to one
 * window's "hello", which every other window ignores, so two replies never cross-apply.
 */
type Msg =
  | { type: "state"; index: number; step: number; play: boolean; cut: boolean; from: string; at: number; to?: string }
  | { type: "hello"; from: string }
  | { type: "handoff"; from: string };

function arrival(from: number, to: number): { play: boolean; cut: boolean } {
  const meta = SLIDES[to];
  const prevId = SLIDES[from]?.id;
  if (meta.playFrom) {
    const hit = meta.playFrom.includes(prevId);
    return { play: hit, cut: hit };
  }
  return { play: to === from + 1, cut: false };
}

export function DeckPlayer({ presenterOnStart, standby }: { presenterOnStart?: boolean; standby?: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const vp = useViewport();
  const idRef = useRef(`w${Math.random().toString(36).slice(2, 8)}`);
  const chanRef = useRef<BroadcastChannel | null>(null);

  const [state, setState] = useState<DeckState>({ index: 0, step: 0, play: false, nonce: 0, cut: false });
  const [ready, setReady] = useState(false);
  const [presenter, setPresenter] = useState(Boolean(presenterOnStart));
  const [indexOpen, setIndexOpen] = useState(false);
  const [blank, setBlank] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [digits, setDigits] = useState("");
  const [pointer, setPointer] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  /** When this window last navigated (0: never, still on its default slide). Newest wins when windows sync. */
  const navAtRef = useRef(0);

  // ---------------- initial slide from the URL hash
  useLayoutEffect(() => {
    const i = indexFromHash(window.location.hash);
    if (i !== null) {
      navAtRef.current = Date.now();
      setState((s) => ({ ...s, index: i, step: i === 0 ? 0 : (SLIDES[i].steps ?? 1) - 1 }));
    }
    setReady(true);
  }, []);

  // ---------------- keep the hash in step (replaceState: Back leaves the deck instead of walking slides)
  useEffect(() => {
    if (!ready) return;
    const want = hashOf(state.index);
    if (window.location.hash !== want) window.history.replaceState(window.history.state, "", want);
  }, [state.index, ready]);

  // ---------------- keys always reach the deck: the live frame on slide 8 must never keep the focus
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    const reclaim = () =>
      window.setTimeout(() => {
        if (document.activeElement?.tagName === "IFRAME") rootRef.current?.focus({ preventScroll: true });
      }, 0);
    window.addEventListener("blur", reclaim);
    const id = window.setInterval(() => {
      if (document.activeElement?.tagName === "IFRAME") rootRef.current?.focus({ preventScroll: true });
    }, 500);
    return () => {
      window.removeEventListener("blur", reclaim);
      window.clearInterval(id);
    };
  }, []);

  // ---------------- dev server only: hide the Next.js dev badge ("N", bottom left) on the slides and, because the
  // style stays in <head> after the deck unmounts, through the live demo in this tab too. A production build has no badge.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || document.getElementById("deck-hide-dev-badge")) return;
    const st = document.createElement("style");
    st.id = "deck-hide-dev-badge";
    st.textContent = "nextjs-portal{display:none!important}";
    document.head.appendChild(st);
  }, []);

  // ---------------- the page scrolls nothing while the deck is up
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  // ---------------- navigation
  const broadcast = useCallback((m: Msg) => {
    try {
      chanRef.current?.postMessage(m);
    } catch {
      /* channel closed */
    }
  }, []);

  /** This window already started the demo (a presenter window stays here): the next key on slide 8 means slide 9. */
  const handoffSentRef = useRef(false);

  const apply = useCallback(
    (next: Omit<DeckState, "nonce">, send = true, at = Date.now()) => {
      if (next.index < HANDOFF_INDEX) handoffSentRef.current = false; // rehearsing again from earlier slides
      navAtRef.current = at;
      setState((s) => ({ ...next, nonce: s.nonce + 1 }));
      setHandoff(false);
      if (send) broadcast({ type: "state", index: next.index, step: next.step, play: next.play, cut: next.cut, from: idRef.current, at });
    },
    [broadcast],
  );

  const goTo = useCallback(
    (to: number, opts?: { step?: number }) => {
      const s = stateRef.current;
      if (to < 0 || to >= SLIDES.length) return;
      const steps = SLIDES[to].steps ?? 1;
      const step = opts?.step ?? (to === 0 ? 0 : steps - 1);
      const a = to === s.index ? { play: false, cut: true } : arrival(s.index, to);
      apply({ index: to, step, play: a.play, cut: a.cut });
    },
    [apply],
  );

  const handoffRef = useRef(false);
  handoffRef.current = handoff;
  const presenterRef = useRef(presenter);
  presenterRef.current = presenter;
  /** Zoom into the live app (T4). A window showing speaker notes never leaves them: it tells the others. */
  const startHandoff = useCallback(
    (send = true) => {
      if (handoffRef.current) return;
      if (send) {
        broadcast({ type: "handoff", from: idRef.current });
        handoffSentRef.current = true;
      }
      if (presenterRef.current) return;
      handoffRef.current = true;
      setHandoff(true);
    },
    [broadcast],
  );

  const next = useCallback(
    (skipDemo = false) => {
      const s = stateRef.current;
      const meta = SLIDES[s.index];
      const steps = meta.steps ?? 1;
      if (s.step < steps - 1) {
        if (s.index === 0 && s.step === 0) {
          writeTimer(Date.now()); // the wordmark flickers in on "Good afternoon": the talk clock starts here
        }
        apply({ index: s.index, step: s.step + 1, play: true, cut: true });
        return;
      }
      if (s.index === HANDOFF_INDEX && !skipDemo && !handoffSentRef.current) {
        startHandoff();
        return;
      }
      if (s.index === LAST_MAIN || s.index === SLIDES.length - 1) return;
      const to = s.index + 1;
      const a = arrival(s.index, to);
      apply({ index: to, step: 0, play: a.play, cut: a.cut });
    },
    [apply, startHandoff],
  );

  const prev = useCallback(() => {
    const s = stateRef.current;
    if (s.step > 0) {
      apply({ index: s.index, step: s.step - 1, play: false, cut: true });
      return;
    }
    if (s.index === 0) return;
    const to = s.index - 1;
    apply({ index: to, step: (SLIDES[to].steps ?? 1) - 1, play: false, cut: false });
  }, [apply]);

  // ---------------- other windows (an audience screen + a presenter laptop)
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    chanRef.current = ch;
    ch.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (!m || m.from === idRef.current) return;
      if (m.type === "hello") {
        const s = stateRef.current;
        ch.postMessage({
          type: "state",
          index: s.index,
          step: s.step,
          play: false,
          cut: true,
          from: idRef.current,
          at: navAtRef.current,
          to: m.from,
        } satisfies Msg);
      } else if (m.type === "state") {
        if (m.to !== undefined) {
          // A reply to our hello: take the window that moved most recently, whatever order the replies arrive in.
          if (m.to !== idRef.current || m.at < navAtRef.current) return;
        }
        apply({ index: m.index, step: m.step, play: m.play, cut: m.cut }, false, m.at);
      } else if (m.type === "handoff") {
        handoffFromPeer.current();
      }
    };
    if (indexFromHash(window.location.hash) === null) ch.postMessage({ type: "hello", from: idRef.current } satisfies Msg);
    return () => {
      ch.close();
      chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Another window started the demo. Speaker notes stay on the demo beats; a visible audience window zooms
  // into the app; a deck tab in the background waits on slide 9, ready for the return.
  const handoffFromPeer = useRef<() => void>(() => {});
  handoffFromPeer.current = () => {
    if (presenterRef.current) return;
    // The return tab: a background tab (or one opened as /deck?standby=1) never follows into the app.
    if (standby || document.visibilityState === "hidden") {
      apply({ index: RETURN_INDEX, step: 0, play: false, cut: true }, false);
      return;
    }
    startHandoff(false);
  };

  // ---------------- the zoom into the live app (T4), then the app takes over
  const [cameraRef, animateCamera] = useAnimate<HTMLDivElement>();
  useEffect(() => {
    if (!handoff) return;
    let cancelled = false;
    // Back from the demo lands on the regional slide.
    window.history.replaceState(window.history.state, "", hashOf(RETURN_INDEX));
    const scene = loadScene("amy-intake").catch(() => DEMO_ROUTE);
    const zoom = (async () => {
      const cam = cameraRef.current;
      const target = cam?.querySelector<HTMLElement>("[data-zoom-target]");
      if (!cam || !target || reduce) return;
      const r = target.getBoundingClientRect();
      const z = window.innerWidth / r.width;
      await animateCamera(
        cam,
        { x: -r.left * z, y: -r.top * z, scale: z },
        { duration: 1.15, ease: [0.7, 0, 0.25, 1] },
      );
    })();
    Promise.all([scene, zoom]).then(([route]) => {
      if (!cancelled) router.push(typeof route === "string" ? route : DEMO_ROUTE);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  // ---------------- keyboard (and presentation clickers: PageUp / PageDown, "." / "b" for black)
  const digitTimer = useRef<number | null>(null);
  const commitDigits = useCallback(
    (buf: string) => {
      setDigits("");
      if (!buf) return;
      const i = indexFromHash(buf);
      if (i !== null) goTo(i);
    },
    [goTo],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = e.key;

      const pushDigit = (d: string) => {
        e.preventDefault();
        setDigits((cur) => {
          const buf = (cur + d).slice(-3);
          if (digitTimer.current) window.clearTimeout(digitTimer.current);
          digitTimer.current = window.setTimeout(() => commitDigits(buf), 700);
          return buf;
        });
      };

      if (/^[0-9]$/.test(k)) return pushDigit(k);
      if ((k === "a" || k === "A") && !e.shiftKey) return pushDigit("a");
      if (k === "Enter" && digits) {
        e.preventDefault();
        if (digitTimer.current) window.clearTimeout(digitTimer.current);
        commitDigits(digits);
        return;
      }

      switch (k) {
        case "ArrowRight":
        case "PageDown":
        case " ":
        case "Spacebar":
          e.preventDefault();
          setBlank(false);
          next(e.shiftKey);
          return;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          setBlank(false);
          prev();
          return;
        case "Home":
          e.preventDefault();
          goTo(0);
          return;
        case "End":
          e.preventDefault();
          goTo(LAST_MAIN);
          return;
        case "n":
        case "N":
          e.preventDefault();
          setPresenter((p) => !p);
          return;
        case "b":
        case "B":
        case ".":
          e.preventDefault();
          setBlank((b) => !b);
          return;
        case "i":
        case "I":
        case "g":
        case "G":
          e.preventDefault();
          setIndexOpen((o) => !o);
          return;
        case "t":
        case "T":
          e.preventDefault();
          writeTimer(Date.now());
          return;
        case "Escape":
          if (indexOpen || blank) {
            e.preventDefault();
            setIndexOpen(false);
            setBlank(false);
          }
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, commitDigits, digits, indexOpen, blank]);

  // ---------------- manual hash edits (typing /deck#12)
  useEffect(() => {
    const onHash = () => {
      const i = indexFromHash(window.location.hash);
      if (i !== null && i !== stateRef.current.index) goTo(i);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [goTo]);

  // ---------------- the pointer hides itself on the projector
  useEffect(() => {
    let t: number | undefined;
    const onMove = () => {
      setPointer(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setPointer(false), 1800);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.clearTimeout(t);
    };
  }, []);

  const s = Math.min(vp.w / STAGE_W, vp.h / STAGE_H);
  const left = (vp.w - STAGE_W * s) / 2;
  const top = (vp.h - STAGE_H * s) / 2;
  const meta = SLIDES[state.index];
  const live = !reduce;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={cn(
        "dark fixed inset-0 z-[60] overflow-hidden bg-black font-sans text-foreground outline-none",
        !pointer && !presenter && "cursor-none",
      )}
      data-testid="deck"
      data-slide={meta.id}
      data-ready={ready ? "1" : undefined}
    >
      {presenter ? (
        <PresenterView index={state.index} step={state.step} onGo={(i) => goTo(i)} />
      ) : (
        <div ref={cameraRef} className="absolute inset-0 origin-top-left">
          <div
            className="absolute origin-top-left"
            style={{ left, top, width: STAGE_W, height: STAGE_H, transform: `scale(${s})` }}
            aria-roledescription="slide"
            aria-label={`${meta.label}: ${meta.title}`}
          >
            {ready ? (
              <AnimatePresence initial={false} custom={state.cut || reduce}>
                <motion.div
                  key={`${state.index}`}
                  className="absolute inset-0"
                  custom={state.cut || reduce}
                  variants={FADE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <SlideView
                    key={state.nonce}
                    index={state.index}
                    mode={live ? "live" : "static"}
                    play={state.play && live}
                    step={state.step}
                    handoff={handoff}
                    onHandoff={() => startHandoff()}
                  />
                </motion.div>
              </AnimatePresence>
            ) : null}
          </div>
        </div>
      )}

      {blank ? <div className="absolute inset-0 z-10 bg-black" aria-hidden /> : null}

      {indexOpen ? <IndexOverlay current={state.index} onGo={(i) => (setIndexOpen(false), goTo(i))} onClose={() => setIndexOpen(false)} /> : null}

      {digits ? (
        <div className="num absolute right-6 bottom-6 z-20 rounded-[3px] bg-popover px-3 py-1.5 font-mono text-[15px] text-foreground">
          Go to {digits.toUpperCase()}
        </div>
      ) : null}

      {!presenter ? (
        <div
          className={cn(
            "absolute right-5 bottom-4 z-20 text-[12px] text-subtle transition-opacity duration-300",
            pointer && !digits ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          → next · N notes · I index · B black · F11 full screen
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- presenter view

function PresenterView({ index, step, onGo }: { index: number; step: number; onGo: (i: number) => void }) {
  const now = useNow();
  const vp = useViewport();
  const meta = SLIDES[index];
  const start = readTimer();
  const elapsed = start ? (now - start) / 1000 : 0;
  const plannedStart = meta.clock ? clockToSeconds(meta.clock[0]) : null;
  const plannedEnd = meta.clock ? clockToSeconds(meta.clock[1]) : null;
  const drift = start && plannedStart !== null ? elapsed - plannedStart : 0;
  const late = start && plannedEnd !== null && elapsed > plannedEnd + 10;
  const nextIndex = index === HANDOFF_INDEX ? null : index + 1 < SLIDES.length && index !== LAST_MAIN ? index + 1 : null;
  const big = Math.min(vp.w * 0.5, 980);

  return (
    <div
      className="absolute inset-0 grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-8 bg-background p-6"
      data-testid="deck-presenter"
    >
      <div className="flex min-h-0 flex-col gap-5">
        <div>
          <p className="mb-2 flex items-baseline gap-3 text-[14px] text-muted-foreground">
            <span className="num font-semibold text-foreground">{meta.label}</span> {meta.title}
            {(meta.steps ?? 1) > 1 ? <span className="text-subtle">· step {step + 1} of {meta.steps}</span> : null}
          </p>
          <SlideThumb index={index} width={big} className="outline outline-1 outline-border-strong" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="mb-2 text-[14px] text-muted-foreground">Next</p>
          {nextIndex !== null ? (
            <button type="button" onClick={() => onGo(nextIndex)} className="block text-left" title="Go to the next slide">
              <SlideThumb index={nextIndex} width={big * 0.5} className="outline outline-1 outline-border" />
              <span className="mt-1.5 block text-[13px] text-subtle">
                {SLIDES[nextIndex].label} · {SLIDES[nextIndex].title}
              </span>
            </button>
          ) : index === HANDOFF_INDEX ? (
            <DemoNotes width={big} />
          ) : (
            <p className="text-[14px] text-subtle">End of the talk. Appendix: A then a number (A1–A8), or I for the index.</p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-6 overflow-y-auto">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-3 border-b border-border pb-4">
          <div>
            <p className="text-[13px] text-subtle">Talk clock</p>
            <p className={cn("num font-mono text-[44px] leading-none", late ? "text-warn" : "text-foreground")}>
              {start ? fmt(elapsed) : "–:––"}
            </p>
          </div>
          {meta.clock ? (
            <div>
              <p className="text-[13px] text-subtle">Planned</p>
              <p className="num text-[22px] leading-none text-secondary-foreground">
                {meta.clock[0]}–{meta.clock[1]} · {meta.seconds} s
              </p>
            </div>
          ) : null}
          {start && plannedStart !== null ? (
            <div>
              <p className="text-[13px] text-subtle">Against plan</p>
              <p className={cn("num text-[22px] leading-none", Math.abs(drift) > 15 ? "text-warn" : "text-secondary-foreground")}>
                {drift >= 0 ? "+" : "−"}
                {fmt(Math.abs(drift))}
              </p>
            </div>
          ) : null}
          <div>
            <p className="text-[13px] text-subtle">Speaker</p>
            <p className="text-[22px] leading-none font-semibold text-foreground">{meta.speaker}</p>
          </div>
          <p className="ml-auto text-[12px] text-subtle">T restarts the clock · N back to slides</p>
        </div>

        {meta.question ? (
          <p className="text-[18px] leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">Question:</span> {meta.question}
            <br />
            <span className="font-semibold text-foreground">Live fallback:</span> {meta.fallback}
          </p>
        ) : null}
        {meta.cue ? (
          <p className="flex gap-3 text-[18px] leading-snug text-warn-ink">
            <span aria-hidden className="mt-2 size-2 shrink-0 rounded-[1px] bg-warn" />
            {meta.cue}
          </p>
        ) : null}
        <p className="text-[clamp(22px,2vw,30px)] leading-[1.45] text-foreground">{meta.say}</p>

        <ul className="mt-auto space-y-1 border-t border-border pt-3 text-[13px] text-subtle">
          {CHECKPOINTS.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DemoNotes({ width }: { width: number }) {
  return (
    <div style={{ width }} className="min-h-0 flex-1 overflow-y-auto pr-2 text-[13px]">
      <p className="mb-2 font-semibold text-foreground">Live demo, Ethan, 5:00</p>
      <ol className="divide-y divide-border border-y border-border">
        {DEMO_BEATS.map((b) => (
          <li key={b.beat} className="grid grid-cols-[96px_1fr] gap-3 py-1.5">
            <span className="num text-muted-foreground">
              {b.beat}
              <br />
              <span className="text-subtle">{b.clock}</span>
            </span>
            <span className="text-secondary-foreground">
              <span className="text-foreground">{b.scene}.</span> {b.line}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- index (Q&A)

function IndexOverlay({ current, onGo, onClose }: { current: number; onGo: (i: number) => void; onClose: () => void }) {
  const groups: { title: string; items: number[] }[] = [
    { title: "Talk", items: SLIDES.map((_, i) => i).filter((i) => !SLIDES[i].appendix) },
    { title: "Appendix for Q&A", items: SLIDES.map((_, i) => i).filter((i) => SLIDES[i].appendix) },
  ];
  return (
    <div
      className="absolute inset-0 z-30 overflow-auto bg-background p-10"
      role="dialog"
      aria-label="All slides"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-12">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 text-[15px] font-semibold text-muted-foreground">{g.title}</h2>
            <ol className="border-t border-border">
              {g.items.map((i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onGo(i)}
                    className={cn(
                      "grid w-full grid-cols-[48px_1fr] items-baseline gap-3 border-b border-border px-2 py-2.5 text-left hover:bg-secondary/60",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      i === current && "bg-secondary",
                    )}
                  >
                    <span className="num text-[15px] text-subtle">{SLIDES[i].label}</span>
                    <span className="text-[16px] text-foreground">
                      {SLIDES[i].title}
                      {SLIDES[i].question ? <span className="mt-0.5 block text-[13px] text-muted-foreground">{SLIDES[i].question}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-[1400px] text-[13px] text-subtle">
        Type a number and wait (12 = slide 12), A then a number for the appendix (A4), or Esc to close.
      </p>
    </div>
  );
}


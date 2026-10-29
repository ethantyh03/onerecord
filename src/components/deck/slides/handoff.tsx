"use client";

import type { SyntheticEvent } from "react";
import { motion } from "motion/react";
import { Headline, SlideFrame, type SlideProps } from "../primitives";
import { useViewport } from "../use-viewport";

/** Where the demo starts: the scene "Clean in: Amy raises a new item" opens this route. */
export const DEMO_ROUTE = "/requests/new?domain=item";

const BEATS: { who: string; what: string }[] = [
  { who: "Amy", what: "pastes her old email; the form fills and routes itself" },
  { who: "Marcus", what: "is stopped from creating a duplicate customer" },
  { who: "Wei Jie", what: "approves in Teams; credit terms never leave OneRecord" },
  { who: "Priya", what: "sends it to SAP; S$36,000 of waiting orders are released" },
  { who: "Regional Pulse", what: "merge the duplicates, and the hidden decline appears" },
];

const FRAME = { x: 948, y: 318, w: 860 };

/** Dev server only: the framed app has its own Next.js dev badge; hide it so the zoom (T4) carries no "N". */
function hideDevBadge(e: SyntheticEvent<HTMLIFrameElement>) {
  if (process.env.NODE_ENV === "production") return;
  try {
    const doc = e.currentTarget.contentDocument;
    if (!doc || doc.getElementById("deck-hide-dev-badge")) return;
    const st = doc.createElement("style");
    st.id = "deck-hide-dev-badge";
    st.textContent = "nextjs-portal{display:none!important}";
    doc.head.appendChild(st);
  } catch {
    /* not same-origin: leave it */
  }
}

/**
 * The live app, dimmed, in a frame with the screen's own proportions, so the zoom (T4) ends with the frame
 * filling the screen exactly where the real page takes over. The iframe lays out at the full viewport size
 * and is scaled down; it is inert (no focus, no pointer). The frame itself is the click target for the demo
 * (no button on the slide: the next key is the real control).
 */
function LiveFrame({ live, handoff, onOpen }: { live: boolean; handoff: boolean; onOpen?: () => void }) {
  const vp = useViewport();
  const aspect = live ? vp.h / vp.w : 1080 / 1920;
  const h = Math.min(FRAME.w * aspect, 660);
  const k = FRAME.w / vp.w;
  return (
    <div className="absolute" style={{ left: FRAME.x, top: FRAME.y, width: FRAME.w }}>
      <motion.div
        data-zoom-target
        className="relative overflow-hidden bg-canvas outline outline-1 outline-border-strong"
        style={{ width: FRAME.w, height: h }}
        initial={false}
        animate={{ opacity: handoff ? 1 : 0.5 }}
        transition={{ duration: 0.3 }}
      >
        {live ? (
          <iframe
            onLoad={hideDevBadge}
            src={DEMO_ROUTE}
            title="OneRecord live app: New request"
            tabIndex={-1}
            inert
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
            style={{ width: vp.w, height: vp.h, transform: `scale(${k})` }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[24px] text-subtle">Live app: New request</div>
        )}
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            disabled={handoff}
            data-testid="deck-open-demo"
            aria-label="Open the live demo"
            className="absolute inset-0 cursor-pointer focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-ring"
          />
        ) : null}
      </motion.div>
      <motion.p
        className="mt-4 text-[20px] leading-none text-subtle"
        initial={false}
        animate={{ opacity: handoff ? 0 : 1 }}
      >
        The live app, in this browser
      </motion.p>
    </div>
  );
}

export function S08DemoHandoff({ thumb, handoff, onHandoff, position }: SlideProps) {
  const live = !thumb;
  return (
    <SlideFrame
      position={position}
      label="Live prototype · synthetic data · Teams, Outlook, SAP B1 and the clock are simulated in the browser."
    >
      <Headline size={58}>
        In five minutes, you&apos;ll watch one request travel from Amy&apos;s email to a decision in Regional Pulse.
      </Headline>

      <ol className="absolute top-[318px] left-[112px] w-[760px] border-t border-border-strong">
        {BEATS.map((b, i) => (
          <li key={b.who} className="grid grid-cols-[52px_1fr] items-baseline border-b border-border py-[17px]">
            <span className="num text-[24px] leading-none text-subtle">{i + 1}</span>
            <span>
              <span
                className="block font-semibold text-foreground"
                style={{ fontSize: 30, lineHeight: 1.1, fontStretch: "112%", letterSpacing: "-0.015em" }}
              >
                {b.who}
              </span>
              <span className="mt-1.5 block text-[25px] leading-[32px] text-muted-foreground">{b.what}</span>
            </span>
          </li>
        ))}
      </ol>

      <LiveFrame live={live} handoff={Boolean(handoff)} onOpen={onHandoff && !thumb ? onHandoff : undefined} />
    </SlideFrame>
  );
}

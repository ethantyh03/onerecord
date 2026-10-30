"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { BrandMark } from "@/components/shell/brand-mark";
import { LINKS } from "@/lib/links";
import { usePitchKeys } from "../_lib/use-pitch-keys";

const TILES = [
  {
    id: "time",
    figure: "≤ 4 business days",
    caption: "Median time from request to live record. Today: median 14 days (Amy's took 18) → ≤ 4 business days.",
  },
  {
    id: "hours",
    figure: "≈1,750 hours a year",
    caption: "handed back to the people who chase, re-key and fix requests. Payback in about 6 months.",
  },
  {
    id: "licences",
    figure: "No new licences",
    caption: "for the workflow (phase 1). Standard Microsoft 365 connectors, Teams and SharePoint, landing in SAP B1 through its own import tool.",
  },
] as const;

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function CloseFrame() {
  const params = useSearchParams();
  const still = params.get("still") === "1";
  const reduceMotion = useReducedMotion();
  const freeze = still || !!reduceMotion;
  const [run, setRun] = useState(0);
  const replay = useCallback(() => setRun((n) => n + 1), []);
  usePitchKeys(replay);

  const reveal = (delay: number) =>
    freeze
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  const links = [
    { label: "Live prototype", url: LINKS.liveUrl },
    { label: "Code", url: LINKS.github },
    { label: "Video", url: LINKS.youtube },
  ].filter((l) => l.url && !/REPLACE_ME/i.test(l.url));

  return (
    <div
      key={run}
      className="relative flex size-full cursor-none flex-col bg-sidebar px-[6vw] pt-[6.5vh] pb-[5vh] text-sidebar-foreground select-none"
      data-testid="pitch-close"
    >
      <div className="flex items-center gap-3 text-white">
        <BrandMark className="size-[clamp(28px,2.2vw,44px)] text-sidebar-primary" />
        <span className="text-[clamp(18px,1.35vw,26px)] font-semibold tracking-[-0.01em]">Tesseract</span>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-x-[3.2vw]">
        {TILES.map((t, i) => (
          <motion.section
            key={t.id}
            className="border-t border-sidebar-primary/45 pt-[2.4vh]"
            data-testid={`pitch-close-tile-${t.id}`}
            {...reveal(0.25 + i * 0.55)}
          >
            <h2 className="text-[clamp(2rem,3.4vw,4.4rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-white proportional-nums">
              {t.figure}
            </h2>
            <p className="mt-[1.6vh] max-w-[34ch] text-[clamp(14px,1.1vw,21px)] leading-snug text-sidebar-foreground/80">
              {t.caption}
            </p>
          </motion.section>
        ))}
      </div>

      <motion.p
        className="mt-[9vh] text-[clamp(4rem,8.4vw,10.5rem)] leading-[0.92] font-semibold tracking-[-0.045em] text-sidebar-primary"
        data-testid="pitch-close-tagline"
        {...reveal(2.2)}
      >
        One hospital.
        <br />
        One record.
      </motion.p>

      <motion.footer
        className="mt-auto flex flex-wrap items-end justify-between gap-x-10 gap-y-3 pt-[5vh] text-[clamp(13px,0.92vw,17px)] text-sidebar-muted"
        {...reveal(2.8)}
      >
        <ul className="flex flex-wrap gap-x-9 gap-y-2">
          {links.map((l) => (
            <li key={l.label}>
              <span className="mr-2 text-sidebar-foreground/60">{l.label}</span>
              <span className="font-medium text-sidebar-foreground">{displayUrl(l.url)}</span>
            </li>
          ))}
        </ul>
        <p>Prototype on synthetic, illustrative data. Figures from our base case (80 requests a month); payback counts hard hours only.</p>
      </motion.footer>
    </div>
  );
}

export default function PitchClosePage() {
  return (
    <Suspense fallback={<div className="size-full bg-sidebar" />}>
      <CloseFrame />
    </Suspense>
  );
}

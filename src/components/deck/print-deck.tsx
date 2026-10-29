"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SlideView } from "./slide-view";
import { SLIDES } from "./slides-config";

/**
 * /deck?print=1: every slide at 1920×1080, in its end state, one per printed page (recording/export-deck.mjs
 * turns this into the PDF and the PNGs). Rendered straight into <body>, so nothing of the console frame prints.
 */
export function PrintDeck() {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.className = "deck-print dark";
    el.dataset.deckPrint = "";
    document.body.appendChild(el);
    setHost(el);
    return () => {
      el.remove();
    };
  }, []);

  useEffect(() => {
    if (!host) return;
    let off = false;
    const fonts = document.fonts?.ready ?? Promise.resolve();
    fonts
      .then(() => new Promise((r) => window.setTimeout(r, 400)))
      .then(() => {
        if (!off) host.dataset.ready = "1";
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [host]);

  if (!host) return null;
  return createPortal(
    <>
      <style>{`
        @page { size: 1920px 1080px; margin: 0; }
        html, body { background: #000 !important; overflow: visible !important; height: auto !important; min-height: 0 !important; }
        body > *:not(.deck-print) { display: none !important; }
        .deck-print { position: relative; width: 1920px; background: var(--background); color: var(--foreground); font-family: var(--font-sans); }
        .deck-print > section { position: relative; width: 1920px; height: 1080px; overflow: hidden; break-after: page; page-break-after: always; }
        .deck-print > section:last-child { break-after: auto; page-break-after: auto; }
        @media screen { .deck-print > section + section { margin-top: 24px; } }
        @media print { .deck-print > section + section { margin-top: 0; } }
      `}</style>
      {SLIDES.map((s, i) => (
        <section key={s.id} data-print-slide={s.label} data-slide-id={s.id} aria-label={`${s.label}: ${s.title}`}>
          <SlideView index={i} mode="static" />
        </section>
      ))}
    </>,
    host,
  );
}

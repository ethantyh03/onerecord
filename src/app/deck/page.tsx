"use client";

import { useSyncExternalStore } from "react";
import { DeckPlayer } from "@/components/deck/deck-player";
import { PrintDeck } from "@/components/deck/print-deck";

const noop = () => () => {};
const readSearch = () => window.location.search;
const serverSearch = () => "";

/**
 * The finals deck, inside the app so the live demo is one click away.
 * /deck            the deck (→ / Space / PageDown next, ← / PageUp back, N notes, F full screen, I index)
 * /deck#9          opens on slide 9 (A4 for appendix slide 4)
 * /deck?presenter=1 a second window that opens on the speaker notes and follows the first
 * /deck?standby=1  the return tab: follows the deck, and when the demo starts it waits on slide 9 instead
 * /deck?print=1    every slide, static, one per page (recording/export-deck.mjs)
 */
export default function DeckPage() {
  const search = useSyncExternalStore(noop, readSearch, serverSearch);
  const params = new URLSearchParams(search);
  if (params.get("print") === "1") return <PrintDeck />;
  return <DeckPlayer presenterOnStart={params.get("presenter") === "1"} standby={params.get("standby") === "1"} />;
}

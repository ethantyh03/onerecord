import { cn } from "@/lib/utils";

/**
 * Original Tesseract mark: three offset strokes resolving into one solid record, in a rounded tile.
 * Kept unchanged for the /pitch/* frames (exported to the submitted PDF). The console uses RecordMark.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)} fill="none">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="currentColor" fillOpacity="0.12" />
      <path d="M7 10.5h9" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 16h7" stroke="currentColor" strokeOpacity="0.65" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 21.5h9" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 10.5c2.6 0 3.2 5.5 5.5 5.5M16.5 21.5c2.6 0 3.2-5.5 5.5-5.5M14 16h8"
        stroke="currentColor"
        strokeOpacity="0.65"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="23.5" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Console mark: three loose entries keyed slightly differently (the same hospital typed three ways),
 * bracketed into one solid record that carries their fields, like a pallet label. No tile behind it.
 * The record's three field lines are cut out with an even-odd path, not an SVG mask: a mask needs a
 * document-wide id, and the copy in the hidden rail (visibility: hidden) would blank every other copy.
 */
export function RecordMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)} fill="none">
      {/* three spellings */}
      <path d="M0.5 9.5h7.5M2.25 16h5.75M1.25 22.5h6.75" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
      {/* bracketed into one */}
      <path d="M8 9.5h2.25v13H8M10.25 16H14" stroke="currentColor" strokeOpacity="0.75" strokeWidth="1.5" />
      {/* the record (16.5 x 22, radius 2) with its three field lines cut out */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M16 5h12.5a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM18.5 9.875v2.25h8v-2.25ZM18.5 14.875v2.25H24v-2.25ZM18.5 19.875v2.25h8v-2.25Z"
      />
    </svg>
  );
}

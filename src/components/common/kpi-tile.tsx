import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Readout, type ReadoutTone } from "./readout";

export type KpiTone = "default" | "brand" | "stuck" | "warn" | "ok";

/** "brand" is not a state (primary is light grey), so it reads as a neutral figure. */
const TONE: Record<KpiTone, ReadoutTone> = {
  default: "default",
  brand: "default",
  stuck: "stuck",
  warn: "warn",
  ok: "ok",
};

export interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  /** One line under the value: what the number means */
  caption?: ReactNode;
  /** Small print: source or assumption reference */
  footnote?: ReactNode;
  tone?: KpiTone;
  /** @deprecated Ignored: readouts carry no icon (an icon before every label is decoration). */
  icon?: LucideIcon;
  /** One quiet marker at the right of the label row, e.g. <LiveMark />. A chip passed here renders without its box. */
  badge?: ReactNode;
  /** The lead figure: wider in an auto ReadoutStrip */
  lead?: boolean;
  href?: string;
  className?: string;
}

/**
 * A headline number, rendered as a readout cell (no box, no rail, no icon): a hairline rule on the
 * left, muted label, semi-expanded tabular figure coloured by state, one line of meaning.
 * Put several inside a <ReadoutStrip> (not a card grid).
 */
export function KpiTile({ label, value, caption, footnote, tone = "default", badge, lead, href, className }: KpiTileProps) {
  return (
    <Readout
      label={label}
      value={value}
      caption={caption}
      footnote={footnote}
      tone={TONE[tone]}
      marker={badge}
      lead={lead}
      href={href}
      className={className}
    />
  );
}

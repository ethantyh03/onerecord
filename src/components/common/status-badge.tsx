import { StatusText } from "./status-text";
import { statusGlyphTone, statusMeta, type AnyStatus, type StatusTone } from "./status-meta";

/**
 * Text colour by status tone. Status is plain text now (no tinted chip), so these are inks only,
 * kept for anything that colours a word by a status tone.
 */
export const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "text-muted-foreground",
  brand: "text-secondary-foreground",
  warn: "text-warn-ink",
  stuck: "text-stuck-ink",
  ok: "text-ok-ink",
};

export interface StatusBadgeProps {
  status: AnyStatus;
  /** Override the default label, e.g. "Approved by Daniel" */
  label?: string;
  /** "sm" for dense rows and cards (12px), "md" elsewhere (13px) */
  size?: "sm" | "md";
  className?: string;
}

/**
 * A request or step status as a state square + label in the state's ink: no border, no fill.
 * done → green, rejected → coral, question → amber, in progress → filled grey, not started → hollow grey.
 * Keeps `data-status` (e2e reads it) and the description as a native tooltip.
 */
export function StatusBadge({ status, label, size = "md", className }: StatusBadgeProps) {
  const meta = statusMeta(status);
  return (
    <StatusText
      title={meta.description}
      data-status={status}
      tone={statusGlyphTone(status)}
      size={size}
      className={className}
    >
      {label ?? meta.label}
    </StatusText>
  );
}

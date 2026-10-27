import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleHelp,
  CircleMinus,
  CircleX,
  Hourglass,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusMeta, type AnyStatus, type StatusMeta, type StatusTone } from "./status-meta";

const ICONS: Record<StatusMeta["icon"], LucideIcon> = {
  draft: CircleDashed,
  progress: Hourglass,
  question: CircleHelp,
  rejected: CircleX,
  review: ShieldCheck,
  done: CircleCheck,
  cancelled: Ban,
  waiting: CircleDashed,
  pending: CircleDot,
  skipped: CircleMinus,
};

export const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  brand: "border-primary/20 bg-primary-soft text-accent-foreground",
  warn: "border-warn/45 bg-warn-soft text-warn-ink",
  stuck: "border-stuck/30 bg-stuck-soft text-stuck-ink",
  ok: "border-ok/30 bg-ok-soft text-ok-ink",
};

export interface StatusBadgeProps {
  status: AnyStatus;
  /** Override the default label, e.g. "Approved by Daniel" */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ status, label, size = "md", className }: StatusBadgeProps) {
  const meta = statusMeta(status);
  const Icon = ICONS[meta.icon];
  return (
    <span
      title={meta.description}
      data-status={status}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "h-5 px-1.5 text-[0.6875rem]" : "h-6 px-2 text-xs",
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      <Icon aria-hidden className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2.25} />
      {label ?? meta.label}
    </span>
  );
}

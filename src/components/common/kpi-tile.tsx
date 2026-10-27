import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "default" | "brand" | "stuck" | "warn" | "ok";

const VALUE_TONE: Record<KpiTone, string> = {
  default: "text-foreground",
  brand: "text-primary",
  stuck: "text-stuck",
  warn: "text-warn-ink",
  ok: "text-ok-ink",
};

const RAIL_TONE: Record<KpiTone, string> = {
  default: "bg-border-strong",
  brand: "bg-primary",
  stuck: "bg-stuck",
  warn: "bg-warn",
  ok: "bg-ok",
};

export interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  /** One line under the value: what the number means */
  caption?: ReactNode;
  /** Small print: source or assumption reference */
  footnote?: ReactNode;
  tone?: KpiTone;
  icon?: LucideIcon;
  /** Badges shown top-right, e.g. <SyntheticBadge /> or a "Live" marker */
  badge?: ReactNode;
  href?: string;
  className?: string;
}

/** A headline number with a short label. The tone colours the value and a thin left rail. */
export function KpiTile({
  label,
  value,
  caption,
  footnote,
  tone = "default",
  icon: Icon,
  badge,
  href,
  className,
}: KpiTileProps) {
  const body = (
    <>
      <span aria-hidden className={cn("absolute inset-y-4 left-0 w-[3px] rounded-r-full", RAIL_TONE[tone])} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted-foreground">
          {Icon ? <Icon aria-hidden className="size-4" strokeWidth={2} /> : null}
          {label}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge}
          {href ? (
            <ArrowUpRight
              aria-hidden
              className="size-4 text-muted-foreground transition-colors group-hover/kpi:text-foreground"
            />
          ) : null}
        </div>
      </div>
      <div className={cn("num mt-2 text-[2rem] leading-none font-semibold tracking-[-0.025em]", VALUE_TONE[tone])}>
        {value}
      </div>
      {caption ? <p className="mt-2.5 text-sm leading-snug text-secondary-foreground">{caption}</p> : null}
      {footnote ? <p className="mt-auto pt-3 text-xs text-muted-foreground">{footnote}</p> : null}
    </>
  );

  const cls = cn(
    "group/kpi relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card px-5 py-4 shadow-raised",
    href && "transition-colors hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
    className,
  );

  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

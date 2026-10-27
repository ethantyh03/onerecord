import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons aligned right on wide screens, below the title on narrow ones */
  actions?: ReactNode;
  /** Small badges next to the title, e.g. <SyntheticBadge /> or a status */
  meta?: ReactNode;
  className?: string;
}

/** Page title block. Pages render it first inside the shell's content area. */
export function PageHeader({ title, subtitle, actions, meta, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
          {meta ? <div className="flex flex-wrap items-center gap-1.5">{meta}</div> : null}
        </div>
        {subtitle ? <p className="max-w-[72ch] text-[0.9375rem] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

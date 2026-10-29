import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isBlankMarker } from "./badges";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons aligned right on wide screens, below the title on narrow ones */
  actions?: ReactNode;
  /**
   * Quiet text beside the title, after a hairline: a source note, an ID + status. Rendered as plain
   * 12px subtle text: any chip passed here loses its border, fill and padding, so pass plain text or an
   * <IllustrativeMarker label="…" />. A marker without a label renders nothing, and so does the hairline.
   */
  meta?: ReactNode;
  className?: string;
}

/**
 * The console title row: page title (28/32, semi-expanded, 600), quiet meta after a vertical
 * hairline (the Gotham meta-column idiom), a one-line purpose under it, page-level controls on the
 * right, and a hairline closing the row. Pages render it first inside the shell's content area.
 */
export function PageHeader({ title, subtitle, actions, meta, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <h1 className="font-wide text-[1.75rem] leading-8 font-semibold text-foreground">{title}</h1>
          {!isBlankMarker(meta) ? (
            <div
              className={cn(
                "flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 border-l border-border-strong pl-4 text-xs leading-4 text-subtle",
                // De-box whatever is passed: chips become quiet text (no border, fill or padding).
                "[&>*]:h-auto [&>*]:rounded-none [&>*]:border-0 [&>*]:bg-transparent [&>*]:px-0 [&>*]:py-0",
                "[&>a>*]:h-auto [&>a>*]:border-0 [&>a>*]:bg-transparent [&>a>*]:px-0 [&>a>*]:py-0 [&>a]:hover:underline [&>a]:underline-offset-4",
              )}
            >
              {meta}
            </div>
          ) : null}
        </div>
        {subtitle ? <p className="max-w-[76ch] text-[0.9375rem] leading-6 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

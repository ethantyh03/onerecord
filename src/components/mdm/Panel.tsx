import type { ReactNode } from "react";
import { Notice } from "@/components/common";
import { cn } from "@/lib/utils";

/**
 * A titled section of the MDM console: a flat panel with a header bar (title left, controls right,
 * hairline under it), 16px content padding and an optional footnote line at the bottom (hairline
 * above, no fill). Nothing inside it is boxed again.
 */
export function Panel({
  title,
  description,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  ...rest
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Small print under the body: provenance and production notes */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  "data-testid"?: string;
}) {
  return (
    <section className={cn("panel flex flex-col overflow-hidden text-sm", className)} {...rest}>
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="panel-title">{title}</h2>
          {description ? <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
      </header>
      <div className={cn("min-w-0 flex-1 p-4", bodyClassName)}>{children}</div>
      {footer ? (
        <div className="mt-auto border-t border-border px-4 py-2.5 text-xs leading-relaxed text-subtle">{footer}</div>
      ) : null}
    </section>
  );
}

/** A count beside a panel or section title: a plain tabular figure, no chip. */
export function CountChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("num ml-2 text-sm font-normal tracking-normal text-subtle [font-stretch:100%]", className)}>
      {children}
    </span>
  );
}

/**
 * The read-only notice a non-MDM persona sees: a ruled line (hairline above and below), an amber square
 * (a permission gate needs attention), the text, and the persona switch on the right. No box, no rail.
 * `icon` is kept for compatibility and ignored: the square carries the state.
 */
export function ViewerNotice({
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Notice ruled tone="warn" action={action} className={className}>
      {children}
    </Notice>
  );
}

/** "MLS" entity with no business-unit config yet (a newly joined BU). */
export function EntityCell({ entity, country, configured }: { entity: string; country: string; configured: boolean }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-[0.8125rem] font-medium text-foreground">
        {entity} <span className="font-normal text-muted-foreground">/ {country}</span>
      </span>
      {configured ? null : (
        <span className="mt-0.5 text-xs text-warn-ink">BU not configured yet — ask MDM to add it</span>
      )}
    </span>
  );
}

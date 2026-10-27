import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A titled section of the MDM console. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  ...rest
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  "data-testid"?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-raised", className)} {...rest}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
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

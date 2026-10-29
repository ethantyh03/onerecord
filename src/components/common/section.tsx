import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isBlankMarker } from "./badges";

export interface SectionTitleProps {
  title: ReactNode;
  /** A plain count after the title (no chip) */
  count?: ReactNode;
  /** Controls at the right end of the hairline: a ghost button, a segmented control, provenance text */
  actions?: ReactNode;
  /** One line under the title row */
  description?: ReactNode;
  as?: "h2" | "h3" | "h4";
  /** "md" = 15px semi-expanded (page sections), "sm" = 14px (sub-sections inside a panel) */
  size?: "sm" | "md";
  id?: string;
  className?: string;
}

/**
 * A ruled section title (osiris SectionTitle): title, plain count, then a hairline running to the
 * right edge, then the controls. For a group on the open page, or a sub-section inside a panel.
 */
export function SectionTitle({
  title,
  count,
  actions,
  description,
  as: H = "h2",
  size = "md",
  id,
  className,
}: SectionTitleProps) {
  return (
    <div className={className}>
      <div className="flex min-h-8 items-center gap-3">
        <H
          id={id}
          className={cn(
            "shrink-0 font-semibold text-foreground",
            size === "md" ? "font-wide text-[0.9375rem] leading-5" : "text-sm leading-5",
          )}
        >
          {title}
        </H>
        {count !== undefined && count !== null ? <span className="num text-sm text-subtle">{count}</span> : null}
        <span aria-hidden className="h-px min-w-6 flex-1 bg-border" />
        {!isBlankMarker(actions) ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="mt-1 max-w-[80ch] text-sm leading-snug text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export interface ConsolePanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  /** A plain count after the title */
  count?: ReactNode;
  /** One line under the title */
  subtitle?: ReactNode;
  /** Controls on the right of the header */
  actions?: ReactNode;
  /** At most one quiet marker in the header (e.g. <IllustrativeMarker label="…" />), before the actions */
  marker?: ReactNode;
  /** The panel's last line: source, caveat, provenance (12px subtle, hairline above, no fill) */
  footnote?: ReactNode;
  /** id for the title, so the panel can be aria-labelledby it */
  titleId?: string;
  as?: "section" | "div" | "aside";
  /** Classes for the body (the hairline-divided stack of PanelSections) */
  bodyClassName?: string;
}

/**
 * The only box (Blueprint Section): a panel with a header bar and a body of hairline-divided
 * PanelSections. Nothing inside it is boxed again: no cards, no tinted callouts, no nested panels.
 * Several small related panels become one ConsolePanel with several PanelSections.
 */
export function ConsolePanel({
  title,
  count,
  subtitle,
  actions,
  marker,
  footnote,
  titleId,
  as: Tag = "section",
  className,
  bodyClassName,
  children,
  ...rest
}: ConsolePanelProps) {
  // A provenance marker without a label renders nothing: treat it as absent so no empty slot is left.
  const markerShown = !isBlankMarker(marker);
  const actionsShown = !isBlankMarker(actions);
  const hasHeader = title || actionsShown || markerShown;
  return (
    <Tag aria-labelledby={title && titleId ? titleId : undefined} {...rest} className={cn("panel min-w-0 overflow-hidden", className)}>
      {hasHeader ? (
        <header className="panel-header">
          <div className="min-w-0">
            {title ? (
              <h2 id={titleId} className="panel-title">
                {title}
                {count !== undefined && count !== null ? (
                  <span className="num ml-2 text-sm font-normal tracking-normal text-subtle [font-stretch:100%]">{count}</span>
                ) : null}
              </h2>
            ) : null}
            {subtitle ? <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{subtitle}</p> : null}
          </div>
          {markerShown || actionsShown ? (
            <div className="flex shrink-0 items-center gap-3">
              {markerShown ? marker : null}
              {actionsShown ? actions : null}
            </div>
          ) : null}
        </header>
      ) : null}
      <div className={cn("divide-y divide-border", bodyClassName)}>
        {children}
        {!isBlankMarker(footnote) ? <PanelFootnote>{footnote}</PanelFootnote> : null}
      </div>
    </Tag>
  );
}

/**
 * A sub-area of a panel (Blueprint SectionCard), separated from its neighbours by a hairline.
 * `flush` for tables and row lists that run edge to edge.
 */
export function PanelSection({
  flush,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return (
    <div {...rest} className={cn(flush ? "p-0" : "p-4", className)}>
      {children}
    </div>
  );
}

/** A panel's last line (Blueprint footer, minus the fill): 12px subtle text with a hairline above. */
export function PanelFootnote({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...rest} className={cn("border-t border-border px-4 py-2.5 text-xs leading-4 text-subtle", className)}>
      {children}
    </p>
  );
}

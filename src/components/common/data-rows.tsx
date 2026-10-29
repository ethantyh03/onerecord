import Link from "next/link";
import type { CSSProperties, HTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Dense rows (pattern sheet C1, osiris TableView): repeating items are a ruled list, not cards.
 * A CSS-grid table: every row shares one grid-template-columns, set once on <DataRows>.
 *
 *   <DataRows label="Waiting on me" columns="minmax(0,1fr) 7rem 7.5rem 6rem">
 *     <DataRowsHead>
 *       <DataHeadCell>Request</DataHeadCell> … <DataHeadCell align="right">Orders waiting</DataHeadCell>
 *     </DataRowsHead>
 *     {items.map((r) => (
 *       <DataRow key={r.id} onClick={…} selected={…} data-testid={`waiting-item-${r.id}`}>
 *         <DataCell><RowTitle id={r.id} title={r.title} /></DataCell>
 *         …
 *         <DataCell align="right" className="font-semibold text-stuck">{formatSgd(r.sgd)}</DataCell>
 *       </DataRow>
 *     ))}
 *   </DataRows>
 *
 * Use ui/table.tsx instead when the markup is already a <table>.
 */

export interface DataRowsProps extends HTMLAttributes<HTMLDivElement> {
  /** CSS grid-template-columns shared by the header and every row, e.g. "minmax(0,1fr) 7rem 6rem" */
  columns: string;
  /** Accessible name of the table */
  label?: string;
  /** "panel" (default): 16px side padding, rows edge to edge in a panel. "page": no side padding, on the open page. */
  inset?: "panel" | "page";
}

export function DataRows({ columns, label, inset = "panel", className, style, children, ...rest }: DataRowsProps) {
  return (
    <div
      role="table"
      aria-label={label}
      data-inset={inset}
      {...rest}
      style={{ "--dr-cols": columns, ...style } as CSSProperties}
      className={cn("group/rows text-sm", className)}
    >
      {children}
    </div>
  );
}

const ROW_GRID =
  "grid grid-cols-(--dr-cols) items-center gap-x-4 px-4 group-data-[inset=page]/rows:px-0";

/** The header row: 36px, 12px subtle sentence-case labels, a stronger hairline under it. */
export function DataRowsHead({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div role="row" className={cn(ROW_GRID, "h-9 border-b border-border-strong text-xs font-medium text-subtle", className)}>
      {children}
    </div>
  );
}

export function DataHeadCell({
  align = "left",
  className,
  children,
}: {
  align?: "left" | "right";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span role="columnheader" className={cn("min-w-0 truncate", align === "right" && "text-right", className)}>
      {children}
    </span>
  );
}

export interface DataRowProps extends Omit<HTMLAttributes<HTMLElement>, "onClick"> {
  /** The row navigates: the whole row is the link */
  href?: string;
  /** The row selects in place (master-detail): the whole row is a button */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Selected in a master-detail list: raised fill + aria-current. No rail. */
  selected?: boolean;
  disabled?: boolean;
}

/**
 * One row: at least 48px, hairline under it. With `href` it is a link, with `onClick` a button
 * (one action per row: the row itself). Hover tints the row; nothing lifts.
 */
export function DataRow({ href, onClick, selected, disabled, className, children, ...rest }: DataRowProps) {
  const interactive = Boolean(href || onClick);
  const cls = cn(
    ROW_GRID,
    "group/row min-h-12 w-full border-b border-border py-2.5 text-left last:border-b-0",
    interactive &&
      "cursor-pointer transition-colors outline-none hover:bg-secondary/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
    selected && "bg-secondary hover:bg-secondary",
    disabled && "pointer-events-none opacity-60",
    className,
  );
  const current = selected ? ("true" as const) : undefined;
  if (href) {
    return (
      <Link role="row" href={href} aria-current={current} {...rest} className={cls}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        role="row"
        aria-current={current}
        disabled={disabled}
        onClick={onClick as MouseEventHandler<HTMLButtonElement>}
        {...(rest as HTMLAttributes<HTMLButtonElement>)}
        className={cls}
      >
        {children}
      </button>
    );
  }
  return (
    <div role="row" aria-current={current} {...(rest as HTMLAttributes<HTMLDivElement>)} className={cls}>
      {children}
    </div>
  );
}

export function DataCell({
  align = "left",
  className,
  children,
}: {
  align?: "left" | "right";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      role="cell"
      className={cn("min-w-0 text-secondary-foreground", align === "right" && "num text-right", className)}
    >
      {children ?? <span className="text-subtle">—</span>}
    </span>
  );
}

/** The primary cell: mono ID above, title under it (truncated), optional quiet line under that. */
export function RowTitle({ id, title, sub }: { id?: ReactNode; title: ReactNode; sub?: ReactNode }) {
  return (
    <span className="block min-w-0">
      {id ? <span className="mono-id block leading-4 text-muted-foreground">{id}</span> : null}
      <span className="mt-0.5 block truncate font-medium text-foreground">{title}</span>
      {sub ? <span className="mt-0.5 block truncate text-xs text-subtle">{sub}</span> : null}
    </span>
  );
}

/** The last cell of a linked row: "Review →" in muted ink that brightens with the row's hover. Not a button. */
export function RowAction({ children = "Review", className }: { children?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-1 text-[0.8125rem] font-medium whitespace-nowrap text-muted-foreground transition-colors group-hover/row:text-foreground",
        className,
      )}
    >
      {children}
      <ArrowRight aria-hidden className="size-3.5" strokeWidth={2} />
    </span>
  );
}

/** A numbered finding / step marker: a plain numeral, no box. */
export function RowNumber({ n, className }: { n: ReactNode; className?: string }) {
  return <span className={cn("num w-5 shrink-0 text-sm text-subtle", className)}>{n}</span>;
}

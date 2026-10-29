import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** null, undefined and "" render as the missing-value dash. */
function isMissing(v: ReactNode): boolean {
  return v === null || v === undefined || v === "" || v === false;
}

/** The missing-value dash, in subtle ink. */
export function Missing({ className }: { className?: string }) {
  return <span className={cn("text-subtle", className)}>—</span>;
}

export interface PropertyItem {
  label: ReactNode;
  value?: ReactNode;
  /** React key; defaults to the label when it is a string */
  key?: string;
}

export interface PropertyListProps {
  /** The pairs, in order. Or pass <Property> children instead. */
  items?: PropertyItem[];
  children?: ReactNode;
  /**
   * "ruled" (default): a hairline above every pair after the first (long lists).
   * "compact": no rules, 8px between pairs (3-5 pairs, osiris Props).
   */
  variant?: "ruled" | "compact";
  /** 2 = two pairs per row from lg up */
  columns?: 1 | 2;
  className?: string;
}

const GRID = {
  1: "grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)]",
  2: "grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)] lg:grid-cols-[minmax(8rem,10rem)_minmax(0,1fr)_minmax(8rem,10rem)_minmax(0,1fr)] lg:gap-x-6",
} as const;

const RULED = {
  1: "[&>dt]:border-t [&>dd]:border-t [&>dt]:py-2 [&>dd]:py-2 [&>*:nth-child(-n+2)]:border-t-0",
  2: "[&>dt]:border-t [&>dd]:border-t [&>dt]:py-2 [&>dd]:py-2 [&>*:nth-child(-n+2)]:border-t-0 lg:[&>*:nth-child(-n+4)]:border-t-0",
} as const;

/**
 * Key: value pairs (the Gotham object view): a two-column definition list, label muted on the left,
 * value on the right, hairline per pair. IDs in mono (SapCode / mono-id), figures `num`, missing "—".
 */
export function PropertyList({ items, children, variant = "ruled", columns = 1, className }: PropertyListProps) {
  return (
    <dl
      className={cn(
        "grid gap-x-4 text-sm leading-5 [&>dd]:min-w-0 [&>dd]:break-words [&>dd]:text-foreground [&>dt]:text-muted-foreground",
        GRID[columns],
        variant === "ruled" ? cn("[&>dd]:border-border [&>dt]:border-border", RULED[columns]) : "gap-y-2",
        className,
      )}
    >
      {items
        ? items.map((it, i) => (
            <Property key={it.key ?? (typeof it.label === "string" ? it.label : i)} label={it.label}>
              {it.value}
            </Property>
          ))
        : children}
    </dl>
  );
}

/** One pair inside a PropertyList. Missing values render as "—". */
export function Property({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return (
    <Fragment>
      <dt>{label}</dt>
      <dd>{isMissing(children) ? <Missing /> : children}</dd>
    </Fragment>
  );
}

/**
 * A changed value: the old one struck through in subtle ink, an arrow, then the new one. Put the
 * existing qualifier ("exceeds SAP limit") after it as <StatusText>.
 */
export function ValueChange({ from, to, className }: { from: ReactNode; to: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <s className="text-subtle decoration-subtle/60">{isMissing(from) ? "—" : from}</s>
      <span aria-hidden className="text-subtle">
        →
      </span>
      <span className="sr-only">changed to</span>
      <span className="text-foreground">{isMissing(to) ? <Missing /> : to}</span>
    </span>
  );
}

export interface MetaColumnItem {
  label: ReactNode;
  value: ReactNode;
  key?: string;
  /** Colour the value by state, e.g. "text-stuck font-semibold" for money waiting */
  valueClassName?: string;
}

/**
 * Gotham meta columns in sentence case: short label over value, each column after a vertical hairline.
 * For object headers (a request, a record) and quiet facts under a title.
 */
export function MetaColumns({ items, className }: { items: MetaColumnItem[]; className?: string }) {
  return (
    <dl className={cn("flex flex-wrap gap-y-3 text-[0.8125rem] leading-5", className)}>
      {items.map((it, i) => (
        <div key={it.key ?? (typeof it.label === "string" ? it.label : i)} className="min-w-0 border-l border-border-strong pr-6 pl-3">
          <dt className="text-subtle">{it.label}</dt>
          <dd className={cn("mt-0.5 text-foreground", it.valueClassName)}>{isMissing(it.value) ? <Missing /> : it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface ObjectHeaderProps {
  /** The identifier, shown in mono before the title (REQ-1042, C-SG-00017) */
  id?: ReactNode;
  title: ReactNode;
  /** Status after the title, e.g. <StatusBadge status=… /> */
  status?: ReactNode;
  /** <MetaColumns items=… /> or any quiet line under the title */
  meta?: ReactNode;
  /** Controls on the right */
  actions?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}

/** A record / request header (Blueprint EntityTitle + Gotham meta columns): mono ID, title, status, meta columns under. */
export function ObjectHeader({ id, title, status, meta, actions, as: H = "h2", className }: ObjectHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {id ? <span className="mono-id text-muted-foreground">{id}</span> : null}
          <H className="font-wide text-xl leading-7 font-semibold text-foreground">{title}</H>
          {status}
        </div>
        {meta ? <div className="mt-3">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

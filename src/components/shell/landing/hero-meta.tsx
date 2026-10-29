"use client";

import type { ReactNode } from "react";
import { dedup, master } from "@/data/contract";
import { cn } from "@/lib/utils";
import { buildCustomerPoints, countByCountry } from "./globe-data";
import { useMergeProgress, type MergeClock } from "./merge-clock";
import { useGlobeRequests } from "./request-globe";

/** Duplicate flags only (positions are not needed for the count), computed once. */
const RECORDS = buildCustomerPoints(master.customers);

/** One fact under the globe, after a thin vertical rule (like the Gotham site's footer row). */
function MetaCol({ children, className, ...rest }: { children: ReactNode; className?: string; "data-testid"?: string }) {
  return (
    <div {...rest} className={cn("min-w-0 border-l border-foreground/40 pr-3 pl-3", className)}>
      {children}
    </div>
  );
}

/**
 * The short figure line: the one place on the console set in small uppercase, at the client's request
 * (the Gotham reference). 12px, foreground.
 */
function Figure({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs leading-5 font-semibold tracking-[0.06em] text-foreground uppercase", className)}>
      {children}
    </p>
  );
}

/** What the figure means on the map: sentence case, 13px, muted (>= 7:1 on the canvas). */
function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-0.5 text-[0.8125rem] leading-[1.35] text-muted-foreground", className)}>{children}</p>;
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 16 12" className="mr-1.5 inline-block h-3 w-4 align-[-1px]" fill="none">
      {children}
    </svg>
  );
}

/** The globe's key: what the marks on it are, drawn as on the map. */
function MapKey({ className }: { className?: string }) {
  const item = "inline-flex items-center gap-1.5 whitespace-nowrap";
  return (
    <p className={cn("flex flex-wrap gap-x-3 gap-y-0.5 text-[0.8125rem] leading-5 text-muted-foreground", className)}>
      <span className="sr-only">Key: </span>
      <span className={item}>
        <svg aria-hidden viewBox="0 0 12 12" className="size-3" fill="none">
          <circle cx="6" cy="6" r="2.4" className="fill-foreground" />
          <circle cx="6" cy="6" r="4.4" className="stroke-foreground/45" strokeWidth="0.8" />
        </svg>
        Hospital
      </span>
      <span className={item}>
        <svg aria-hidden viewBox="0 0 12 12" className="size-3">
          <circle cx="6" cy="6" r="1.85" className="fill-foreground" />
        </svg>
        Lab
      </span>
      <span className={item}>
        <svg aria-hidden viewBox="0 0 12 12" className="size-3">
          <circle cx="6" cy="6" r="1.2" className="fill-foreground" />
        </svg>
        Clinic, other
      </span>
      <span className={item}>
        <svg aria-hidden viewBox="0 0 12 12" className="size-3">
          <circle cx="6" cy="6" r="2.1" className="fill-stuck" />
        </svg>
        Duplicate
      </span>
      <span className={item}>
        <svg aria-hidden viewBox="0 0 12 12" className="size-3" fill="none">
          <path d="M6 1.5 10.5 6 6 10.5 1.5 6Z" className="fill-canvas stroke-foreground" strokeWidth="1.2" />
        </svg>
        Entity
      </span>
    </p>
  );
}

/**
 * The map's Raw / Merged view, as a small segmented control (buttons with aria-pressed). "Merged" stays
 * pressed while the duplicates glide in, so the control shows where the map is going.
 */
function ViewToggle({ merged, onChange }: { merged: boolean; onChange: (merged: boolean) => void }) {
  const options = [
    { merged: false, label: "Raw", title: "Raw SAP records: every customer record, duplicates included" },
    { merged: true, label: "Merged", title: "Merged customers: each duplicate folded into its customer" },
  ];
  return (
    <div
      role="group"
      aria-label="Customer records on the map"
      className="mt-1.5 inline-flex items-center gap-0.5 rounded-sm border border-border-strong bg-canvas/80 p-0.5"
    >
      {options.map((o) => {
        const active = o.merged === merged;
        return (
          <button
            key={o.label}
            type="button"
            title={o.title}
            aria-pressed={active}
            data-testid={`home-map-${o.merged ? "merged" : "raw"}`}
            onClick={() => onChange(o.merged)}
            className={cn(
              "h-6 rounded-[3px] px-2 text-[0.8125rem] leading-none font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The facts under the globe, all real: the customer records and their duplicates, with the merge counter
 * (388 customer records → 363 distinct customers, from dedup.json) and the map's Raw / Merged view, the
 * open requests the arcs and rings are, the five entities, and the map key. (The platform line is the
 * badge above the headline.)
 */
export function HeroMeta({
  merge,
  reduce,
  onShowMerged,
  className,
}: {
  merge: MergeClock;
  reduce: boolean;
  /** Switch the map to merged customers (true) or raw SAP records (false). */
  onShowMerged: (merged: boolean) => void;
  className?: string;
}) {
  const { landed, phase } = useMergeProgress(merge, RECORDS, reduce);
  const raw = dedup.customers.rawRecords;
  const golden = dedup.customers.goldenCustomers;
  const dups = dedup.customers.duplicateRecords;

  const list = useGlobeRequests();
  const n = list.length;
  const hub = countByCountry(list).SG;

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-y-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.15fr)_minmax(0,0.75fr)_minmax(0,1.45fr)] lg:gap-y-0",
        className,
      )}
    >
      <MetaCol>
        <p className="sr-only">
          {raw} customer records in SAP are {golden} distinct customers once the {dups} duplicates are merged.
        </p>
        <div aria-hidden>
          <Figure>
            <Glyph>
              <circle cx="4" cy="6" r="2.4" className="fill-foreground" />
              <circle cx="4" cy="6" r="3.9" className="stroke-foreground/50" strokeWidth="0.8" />
              <circle cx="10" cy="6.5" r="1.8" className="fill-foreground/80" />
              <circle cx="14" cy="7" r="1.2" className="fill-foreground/80" />
            </Glyph>
            {phase === "merged" ? (
              <>
                <span className="num">{golden}</span> distinct customers
              </>
            ) : (
              <>
                <span className="num">{raw - landed}</span> customer records
              </>
            )}
          </Figure>
          <Note className={cn(phase === "raw" && "text-stuck-ink")}>
            {phase === "raw" ? (
              <>
                <Glyph>
                  <path d="M3 6h9" className="stroke-stuck/70" strokeWidth="0.9" />
                  <circle cx="3" cy="6" r="2" className="fill-stuck" />
                </Glyph>
                <span className="num">{dups}</span> are duplicates of a customer already in SAP
              </>
            ) : phase === "merging" ? (
              <>Merging the duplicates into their customers…</>
            ) : (
              <>
                <span className="num">{raw}</span> customer records · <span className="num">{dups}</span> duplicates
              </>
            )}
          </Note>
        </div>
        <ViewToggle merged={phase !== "raw"} onChange={onShowMerged} />
      </MetaCol>

      <MetaCol data-testid="home-globe-caption">
        <Figure>
          <Glyph>
            <path d="M1.5 10C4 2.5 10 1.5 14.5 6" className="stroke-signal/70" strokeWidth="1.25" />
            <circle cx="14.5" cy="6" r="1.7" className="fill-signal" />
          </Glyph>
          <span className="sr-only">Map of open requests: </span>
          {n === 0 ? (
            "No open requests"
          ) : (
            <>
              <span className="num">{n}</span> open request{n === 1 ? "" : "s"}
            </>
          )}
        </Figure>
        <Note>
          {n === 0
            ? "A new request draws an arc to the MDM team in Singapore."
            : `${n === 1 ? "The arc runs" : "Each arc runs"} to the MDM team in Singapore.`}
          {hub > 0 ? " Rings are requests raised in Singapore." : ""}
        </Note>
      </MetaCol>

      <MetaCol>
        <Figure>
          <Glyph>
            <path d="M8 1.5 12.5 6 8 10.5 3.5 6Z" className="stroke-foreground" strokeWidth="1.2" />
          </Glyph>
          5 entities
        </Figure>
        <Note className="mono-id">SG MY TH VN MM</Note>
      </MetaCol>

      <MetaCol>
        <Figure>Map key</Figure>
        <Note>One dot per customer record, placed by postcode area:</Note>
        <MapKey className="mt-1" />
      </MetaCol>
    </div>
  );
}

import { Check } from "lucide-react";
import { SapCode } from "@/components/common/sap-code";
import { cn } from "@/lib/utils";

/**
 * Illustrative: three requestors (one per entity) type the same hospital their own way.
 * Each request is caught at intake against the one master record, so no copy is created.
 * The master record itself belongs to SPD (seed: C-SG-00017, entity SPD).
 */
const SPELLINGS = [
  { entity: "SPD", typed: "Natl Univ Hosp" },
  { entity: "QTS", typed: "National University Hosp." },
  { entity: "QTG", typed: "Nat'l University Hospital" },
];

/** Three typed entries merge into one record: reads left to right when there is room, top to bottom when not. */
export function GoldenRecord({ className }: { className?: string }) {
  return (
    <figure className={cn("@container panel overflow-hidden", className)}>
      <figcaption className="panel-header min-h-10 py-2">
        <span className="panel-title text-sm">Three requests, three spellings, one record</span>
      </figcaption>

      <div className="grid gap-y-1.5 p-3 @[30rem]:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1.15fr)] @[30rem]:items-center @[30rem]:gap-y-0">
        <ul className="space-y-1.5">
          {SPELLINGS.map((s) => (
            <li
              key={s.entity}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline gap-x-2 rounded-md border border-dashed border-border-strong px-2.5 py-1.5"
            >
              <span className="mono-id text-xs text-subtle" title={`Typed by a ${s.entity} requestor`}>
                {s.entity}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="min-w-0 truncate text-sm text-muted-foreground line-through decoration-muted-foreground/50 decoration-[1.5px]">
                  {s.typed}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-ok-ink">
                  <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                  Caught at intake
                </span>
              </span>
            </li>
          ))}
        </ul>

        {/* Three lines merge into one: sideways in the wide layout, downwards in the narrow one */}
        <svg
          aria-hidden
          viewBox="0 0 28 120"
          preserveAspectRatio="none"
          className="hidden h-[calc(100%-1.5rem)] w-full text-border-strong @[30rem]:block"
          fill="none"
        >
          <path
            d="M0 20c10 0 12 40 22 40M0 60h22M0 100c10 0 12-40 22-40M22 60h6"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div aria-hidden className="flex h-5 justify-center @[30rem]:hidden">
          <svg viewBox="0 0 120 24" className="h-5 w-24 text-border-strong" fill="none" preserveAspectRatio="none">
            <path d="M20 0c0 14 40 10 40 24M60 0v24M100 0c0 14-40 10-40 24" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="rounded-md border border-border-strong bg-secondary px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <p className="font-wide text-[0.9375rem] leading-5 font-semibold text-foreground">
              National University Hospital
            </p>
            <SapCode code="C-SG-00017" className="bg-card text-xs" />
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.8125rem] leading-5">
            <dt className="text-muted-foreground">UEN</dt>
            <dd className="mono-id text-foreground">198500123K</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd className="text-foreground">5 Lower Kent Ridge Road, Singapore 119074</dd>
            <dt className="text-muted-foreground">Master record</dt>
            <dd className="text-foreground">SPD · no duplicates created</dd>
          </dl>
        </div>
      </div>
    </figure>
  );
}

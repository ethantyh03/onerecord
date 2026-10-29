"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { cn } from "@/lib/utils";
import { openQueueRows } from "./globe-data";

/** The same marks the globe uses: an arc for a request travelling to Singapore, a ring for one raised there. */
function RowMark({ hub }: { hub: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 16 12" className="h-3 w-4 shrink-0" fill="none">
      {hub ? (
        <>
          <circle cx="8" cy="6" r="4.75" className="stroke-signal/70" strokeWidth="1.25" />
          <circle cx="8" cy="6" r="1.4" className="fill-signal" />
        </>
      ) : (
        <>
          <path d="M1.5 10C4 2.5 10 1.5 14.5 6" className="stroke-signal/60" strokeWidth="1.25" />
          <circle cx="14.5" cy="6" r="1.6" className="fill-signal" />
        </>
      )}
    </svg>
  );
}

/**
 * The open-request queue, right under the hero (our analogue of the Gotham site's target board): every
 * open request in this browser's sandbox, newest first, each one an arc or ring on the globe above.
 * Pointing at a row lights its arc; each row opens the request.
 */
export function LiveRequestPanel({
  onPoint,
  className,
}: {
  /** The row being pointed at (hover or keyboard focus), or null */
  onPoint: (id: string | null) => void;
  className?: string;
}) {
  const requests = useSandbox((s) => s.requests);
  const rows = useMemo(() => openQueueRows(requests), [requests]);

  return (
    <section aria-labelledby="home-queue-title" className={cn("panel overflow-hidden", className)}>
      <div className="panel-header">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id="home-queue-title" className="panel-title whitespace-nowrap">
            Open requests
          </h2>
          <span className="num rounded-sm bg-signal-soft px-1.5 text-xs leading-5 font-semibold text-signal">
            {rows.length}
          </span>
          <p className="ml-1 hidden truncate text-sm text-muted-foreground sm:block">
            Hover a request to find it on the map.
          </p>
        </div>
        <Link
          href="/requests"
          className="inline-flex shrink-0 items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          All requests
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">Nothing is open. A new request appears here.</p>
      ) : (
        <ul
          className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          onMouseLeave={() => onPoint(null)}
        >
          {rows.map((r) => (
            <li key={r.id} className="border-r border-b border-border">
              <Link
                href={`/requests/view?id=${encodeURIComponent(r.id)}`}
                onMouseEnter={() => onPoint(r.id)}
                onFocus={() => onPoint(r.id)}
                onBlur={() => onPoint(null)}
                className="group block h-full px-4 py-2.5 outline-none hover:bg-secondary/70 focus-visible:bg-secondary/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex items-center gap-2 text-[0.8125rem] leading-4">
                  <RowMark hub={r.country === "SG"} />
                  <span className="mono-id shrink-0 whitespace-nowrap text-foreground">{r.id}</span>
                  <span className="mono-id shrink-0 text-muted-foreground">{r.country}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">{r.stage}</span>
                </span>
                <span className="mt-1 block truncate text-sm leading-5 text-secondary-foreground group-hover:text-foreground">
                  {r.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

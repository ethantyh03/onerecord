"use client";

import { useMemo } from "react";
import type { MdmRequest } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { selectPrsForRequest, useNow } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { PanelFootnote, StatusText, formatSgd } from "@/components/common";

const DAY_MS = 86_400_000;

/** "Waiting on this record": the customer purchase requests that can't convert until this record exists in SAP B1. */
export function BlockedOrdersCard({ request }: { request: MdmRequest }) {
  const prs = useSandbox((s) => s.prs);
  const requests = useSandbox((s) => s.requests);
  const now = useNow(30_000);
  const linked = useMemo(() => selectPrsForRequest({ prs, requests }, request.id), [prs, requests, request.id]);

  const blocked = linked.filter((p) => p.status === "blocked");
  const released = linked.filter((p) => p.status !== "blocked");
  const blockedSgd = blocked.reduce((a, p) => a + p.sgd, 0);
  const releasedSgd = released.reduce((a, p) => a + p.sgd, 0);
  const nowMs = Date.parse(now);

  return (
    <section data-testid="blocked-orders" className="panel overflow-hidden" aria-labelledby="blocked-heading">
      <div className="panel-header">
        <h2 id="blocked-heading" className="panel-title">
          Waiting on this record
        </h2>
      </div>
      <div className="px-4 pt-3.5 pb-3.5">
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No customer orders are waiting on this record.</p>
        ) : blocked.length ? (
          <>
            <p className="num font-wide text-[2.25rem] leading-none font-semibold text-stuck" data-testid="blocked-orders-total">
              {formatSgd(blockedSgd)}
            </p>
            <p className="mt-2.5 text-sm leading-snug text-secondary-foreground">
              of customer orders ({blocked.length} purchase request{blocked.length === 1 ? "" : "s"}) can&apos;t become sales orders until this
              record is live in SAP B1.
            </p>
          </>
        ) : (
          <>
            <p className="num font-wide text-[2.25rem] leading-none font-semibold text-ok-ink" data-testid="blocked-orders-total">
              {formatSgd(releasedSgd)}
            </p>
            <p className="mt-2.5 text-sm leading-snug text-secondary-foreground">
              of customer orders released when the record went live. They can now be converted.
            </p>
          </>
        )}
      </div>

      {linked.length ? (
        <ul className="divide-y divide-border border-t border-border">
          {linked.map((p) => {
            const isBlocked = p.status === "blocked";
            const days = Math.max(0, Math.floor((nowMs - Date.parse(p.createdAt)) / DAY_MS));
            return (
              <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-2.5" data-testid={`blocked-pr-${p.id}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="mono-id">{p.id}</span> · {p.itemName}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("num text-sm font-semibold", isBlocked ? "text-stuck-ink" : "text-ok-ink")}>{formatSgd(p.sgd)}</p>
                  <p className="text-xs text-muted-foreground">
                    {isBlocked ? (
                      <span className="num">
                        blocked {days} day{days === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <StatusText tone="ok" size="sm">
                        released
                      </StatusText>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {linked.length ? (
        <PanelFootnote>Synthetic, illustrative orders.</PanelFootnote>
      ) : null}
    </section>
  );
}

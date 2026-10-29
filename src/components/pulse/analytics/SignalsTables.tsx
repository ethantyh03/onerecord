"use client";

import { useState } from "react";
import { formatSgd } from "@/components/common";
import { usePulse } from "@/components/pulse/core/PulseContext";
import { signals, type CrossSellRow, type DropOffRow, type SignalRowBase } from "@/data/contract";
import { cn } from "@/lib/utils";
import { COUNTRY_NAME, PanelFrame, Segmented } from "./shared";

type Tab = "dropoff" | "crosssell";
type Scope = "all" | "country";

function MoneyCell({ row }: { row: SignalRowBase }) {
  const rate = Math.round(row.assumedConversion * 100);
  return (
    <td className="px-3 py-2.5 text-right align-top">
      <div className="num font-semibold">{formatSgd(row.sgdAddressable, { compact: true })}</div>
      <div className="num text-xs whitespace-nowrap text-muted-foreground">
        × {rate}% = {formatSgd(row.sgdAddressable * row.assumedConversion, { compact: true })}
      </div>
    </td>
  );
}

function IdCells({ row, highlight }: { row: SignalRowBase; highlight: boolean }) {
  return (
    <>
      <td className="px-3 py-2.5 align-top">
        <div className={cn("font-medium", highlight && "text-foreground")}>{row.name}</div>
        <div className="mt-0.5 text-sm leading-none">
          <span className="mono-id text-muted-foreground">{row.goldenId}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-top whitespace-nowrap">{COUNTRY_NAME[row.country]}</td>
      <td className="px-3 py-2.5 align-top whitespace-nowrap">
        {row.product} <span className="text-xs text-muted-foreground">({row.entity})</span>
      </td>
    </>
  );
}

function Head({ rateLabel }: { rateLabel: string }) {
  return (
    <thead className="text-xs text-subtle">
      <tr className="border-b border-border-strong">
        <th className="px-3 py-2 text-left font-medium" title="Golden ID: one ID per real hospital, however many SAP records it has">
          Customer (one ID per real hospital)
        </th>
        <th className="px-3 py-2 text-left font-medium">Country</th>
        <th className="px-3 py-2 text-left font-medium">Product</th>
        <th className="px-3 py-2 text-left font-medium">Why it is flagged</th>
        <th className="px-3 py-2 text-right font-medium">
          S$ addressable, before conversion
          <div className="font-normal">{rateLabel}</div>
        </th>
      </tr>
    </thead>
  );
}

/** Component 9b: drop-off risk and cross-sell gaps on merged customers. */
export function SignalsTables() {
  const { country } = usePulse();
  const [tab, setTab] = useState<Tab>("dropoff");
  const [scope, setScope] = useState<Scope>("all");
  const a = signals.assumptions;

  const inScope = <T extends SignalRowBase>(rows: T[]) =>
    [...rows].filter((r) => scope === "all" || r.country === country).sort((x, y) => y.sgdAddressable - x.sgdAddressable);

  const drop: DropOffRow[] = inScope(signals.dropOff);
  const cross: CrossSellRow[] = inScope(signals.crossSell);
  const rows = tab === "dropoff" ? drop : cross;
  const sum = rows.reduce((s, r) => s + r.sgdAddressable, 0);
  const rate = tab === "dropoff" ? a.dropOffSaveRate : a.crossSellConversion;

  return (
    <PanelFrame
      testId="signals-tables"
      title="Customers to act on"
      subtitle="Computed on merged customers (one ID per real hospital), so a hospital that buys through several entities is judged as one customer. Hover a reason to read it in full."
      actions={
        <>
          <Segmented<Tab>
            label="Signal"
            value={tab}
            onChange={setTab}
            testIdPrefix="signals-tab"
            options={[
              { value: "dropoff", label: `Drop-off risk (${drop.length})` },
              { value: "crosssell", label: `Cross-sell gaps (${cross.length})` },
            ]}
          />
          <Segmented<Scope>
            label="Countries"
            value={scope}
            onChange={setScope}
            testIdPrefix="signals-scope"
            options={[
              { value: "all", label: "All countries" },
              { value: "country", label: COUNTRY_NAME[country] },
            ]}
          />
        </>
      }
    >
      <p className="mb-3 text-sm text-secondary-foreground">
        {tab === "dropoff"
          ? "Customers whose last 6 months are well below the 6 before, or who are overdue for their usual reorder."
          : "Customers buying well below similar customers in a product, including hospitals with our instruments installed but low reagent orders."}
      </p>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[820px] text-sm">
          <Head rateLabel={tab === "dropoff" ? `× ${Math.round(a.dropOffSaveRate * 100)}% assumed save rate` : `× ${Math.round(a.crossSellConversion * 100)}% assumed conversion`} />
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No customers flagged in {COUNTRY_NAME[country]} for this signal. Switch to all countries to compare.
                </td>
              </tr>
            ) : tab === "dropoff" ? (
              drop.map((r) => (
                <tr key={`${r.goldenId}-${r.product}`} className="border-b transition-colors last:border-b-0 hover:bg-secondary/60">
                  <IdCells row={r} highlight={r.country === country} />
                  <td className="max-w-[46ch] px-3 py-2.5 align-top">
                    <div className="line-clamp-2 leading-snug" title={r.reason}>
                      {r.reason}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Last 6 months {formatSgd(r.trailing6mSgd, { compact: true })} vs {formatSgd(r.prior6mSgd, { compact: true })} ·{" "}
                      {r.daysSinceLastPo} days since last order (usual {r.medianReorderDays})
                    </div>
                  </td>
                  <MoneyCell row={r} />
                </tr>
              ))
            ) : (
              cross.map((r) => (
                <tr key={`${r.goldenId}-${r.product}`} className="border-b transition-colors last:border-b-0 hover:bg-secondary/60">
                  <IdCells row={r} highlight={r.country === country} />
                  <td className="max-w-[46ch] px-3 py-2.5 align-top">
                    <div className="line-clamp-2 leading-snug" title={r.reason}>
                      {r.reason}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Peer median {formatSgd(r.peerMedianSgd, { compact: true })} a year
                      {r.installedBase ? " · our instrument installed" : ""}
                    </div>
                  </td>
                  <MoneyCell row={r} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <span>
          {rows.length} customers · {formatSgd(sum, { compact: true })} addressable, before conversion · at the assumed{" "}
          {Math.round(rate * 100)}% that is about {formatSgd(sum * rate, { compact: true })}.
        </span>
        <span>{a.label}</span>
      </div>
    </PanelFrame>
  );
}

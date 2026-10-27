"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Building2, Pencil, Plus } from "lucide-react";
import type { BusinessUnit } from "@/lib/types";
import { PRODUCT_LABELS } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { PersonChip } from "@/components/common";
import { Button } from "@/components/ui/button";
import { BuSheet } from "./bu-sheet";
import { Chip, roleLabel } from "./shared";

export function BusinessUnitsTab({ onBuSaved }: { onBuSaved?: (buId: string) => void }) {
  const config = useSandbox((s) => s.config);
  const requests = useSandbox((s) => s.requests);
  const [sheet, setSheet] = useState<{ open: boolean; editing?: BusinessUnit; presetCode?: string }>({ open: false });

  const unconfigured = useMemo(() => {
    const known = new Set(config.businessUnits.map((b) => b.id));
    const byEntity = new Map<string, string[]>();
    for (const p of config.people) {
      if (known.has(p.entity)) continue;
      byEntity.set(p.entity, [...(byEntity.get(p.entity) ?? []), p.id]);
    }
    return [...byEntity.entries()];
  }, [config.businessUnits, config.people]);

  const inFlight = (buId: string) =>
    requests.filter((r) => r.entity === buId && (r.status === "in_approval" || r.status === "needs_info" || r.status === "mdm_review")).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Business units</h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            Each BU decides who approves its requests and can add its own stages. Add a newly joined business in under a minute.
          </p>
        </div>
        <Button onClick={() => setSheet({ open: true })} data-testid="admin-add-bu">
          <Plus /> Add business unit
        </Button>
      </div>

      {unconfigured.map(([entity, ids]) => (
        <div
          key={entity}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3"
          data-testid={`admin-bu-unconfigured-${entity}`}
        >
          <AlertTriangle className="size-5 shrink-0 text-warn-ink" aria-hidden />
          <div className="min-w-0 flex-1 text-[0.8125rem] text-warn-ink">
            <p className="font-semibold">{entity} has people but no business-unit setup</p>
            <p>
              {ids.map((id) => config.people.find((p) => p.id === id)?.name ?? id).join(", ")} can raise requests, but they go to whoever
              holds each role first, not to {entity}&rsquo;s own approvers.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSheet({ open: true, presetCode: entity })} data-testid={`admin-setup-bu-${entity}`}>
            Set up {entity}
          </Button>
        </div>
      ))}

      <div className="grid gap-3 xl:grid-cols-2">
        {config.businessUnits.map((bu) => (
          <article key={bu.id} className="flex flex-col rounded-xl border border-border bg-card shadow-raised" data-testid={`admin-bu-${bu.id}`}>
            <header className="flex items-start gap-3 border-b border-border px-4 py-3">
              <span className="inline-flex h-8 min-w-11 items-center justify-center rounded-md bg-primary px-1.5 font-mono text-xs font-semibold text-primary-foreground">
                {bu.id}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[0.9375rem] font-semibold text-foreground">{bu.name}</h3>
                <p className="line-clamp-2 text-xs text-muted-foreground">{bu.description || "No description"}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSheet({ open: true, editing: bu })} aria-label={`Edit ${bu.name}`}>
                <Pencil /> Edit
              </Button>
            </header>
            <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3 text-[0.8125rem]">
              <div>
                <dt className="text-xs text-muted-foreground">{roleLabel("bu_head")}</dt>
                <dd className="mt-0.5">{bu.roleAssignments.bu_head ? <PersonChip personId={bu.roleAssignments.bu_head} /> : "Not set"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{roleLabel("business_support")}</dt>
                <dd className="mt-0.5">
                  {bu.roleAssignments.business_support ? <PersonChip personId={bu.roleAssignments.business_support} /> : "Group default"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Main product</dt>
                <dd className="mt-0.5 text-foreground">{bu.mainProduct ? PRODUCT_LABELS[bu.mainProduct] : "Mixed"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Requests in flight</dt>
                <dd className="mt-0.5 font-medium text-foreground tabular-nums">{inFlight(bu.id)}</dd>
              </div>
            </dl>
            <footer className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-2.5">
              <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
              {bu.extraStages.length ? (
                bu.extraStages.map((s) => (
                  <Chip key={s.id} tone="brand">
                    + {s.label}
                  </Chip>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Standard routes, no extra stages</span>
              )}
            </footer>
          </article>
        ))}
      </div>

      <BuSheet
        open={sheet.open}
        editing={sheet.editing}
        presetCode={sheet.presetCode}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        onSaved={onBuSaved}
      />
    </div>
  );
}

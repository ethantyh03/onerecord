"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { BusinessUnit } from "@/lib/types";
import { PRODUCT_LABELS } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { Notice, PersonChip } from "@/components/common";
import { Button } from "@/components/ui/button";
import { BuSheet } from "./bu-sheet";
import { pendingEntityLabel } from "./bu-template";
import { describeRule, roleLabel, SectionHeader } from "./shared";

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

  const fieldLabel = (key: string) => {
    for (const d of config.domains) {
      const f = d.fields.find((x) => x.key === key);
      if (f) return f.label.toLowerCase();
    }
    return key;
  };

  const inFlight = (buId: string) =>
    requests.filter((r) => r.entity === buId && (r.status === "in_approval" || r.status === "needs_info" || r.status === "mdm_review")).length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Business units"
        description="Each BU decides who approves its requests and can add its own stages. Add a business unit when a new business joins."
        actions={
          <Button onClick={() => setSheet({ open: true })} data-testid="admin-add-bu">
            <Plus /> Add business unit
          </Button>
        }
      />

      {unconfigured.map(([entity, ids]) => (
        <Notice
          key={entity}
          ruled
          tone="warn"
          data-testid={`admin-bu-unconfigured-${entity}`}
          action={
            <Button variant="outline" size="sm" onClick={() => setSheet({ open: true, presetCode: entity })} data-testid={`admin-setup-bu-${entity}`}>
              Set up {entity}
            </Button>
          }
        >
          <p className="font-medium text-warn-ink">{pendingEntityLabel(entity)} has people but no business-unit setup</p>
          <p>
            {ids.map((id) => config.people.find((p) => p.id === id)?.name ?? id).join(", ")} can raise requests, but they go to whoever
            holds each role first, not to {entity}&rsquo;s own approvers.
          </p>
        </Notice>
      ))}

      {/* One panel, one business unit per hairline-divided row: identity, then its facts as meta columns. */}
      <div className="panel divide-y divide-border overflow-hidden">
        {config.businessUnits.map((bu) => (
          <article key={bu.id} className="px-4 pt-3.5 pb-4" data-testid={`admin-bu-${bu.id}`}>
            <header className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  {bu.name.startsWith(bu.id) ? null : <span className="mono-id text-muted-foreground">{bu.id}</span>}
                  <h3 className="panel-title truncate">{bu.name}</h3>
                </div>
                <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug text-muted-foreground">{bu.description || "No description"}</p>
              </div>
              <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" onClick={() => setSheet({ open: true, editing: bu })} aria-label={`Edit ${bu.name}`}>
                <Pencil /> Edit
              </Button>
            </header>
            <dl className="mt-3.5 grid grid-cols-2 gap-y-3 text-[0.8125rem] md:grid-cols-[repeat(3,minmax(0,1fr))_auto] [&>div]:min-w-0 [&>div]:border-l [&>div]:border-border-strong [&>div]:pr-5 [&>div]:pl-3">
              <div>
                <dt className="text-xs text-subtle">{roleLabel("bu_head")}</dt>
                <dd className="mt-1">{bu.roleAssignments.bu_head ? <PersonChip personId={bu.roleAssignments.bu_head} /> : <span className="text-muted-foreground">Not set</span>}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">{roleLabel("business_support")}</dt>
                <dd className="mt-1">
                  {bu.roleAssignments.business_support ? (
                    <PersonChip personId={bu.roleAssignments.business_support} />
                  ) : (
                    <span className="text-muted-foreground">Group default</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Main product</dt>
                <dd className="mt-1 text-foreground">{bu.mainProduct ? PRODUCT_LABELS[bu.mainProduct] : "Mixed"}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Requests in flight</dt>
                <dd className="num mt-1 font-medium text-foreground">{inFlight(bu.id)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
              {bu.extraStages.length ? (
                bu.extraStages.map((s) => (
                  <span key={s.id} className="text-secondary-foreground">
                    <span className="font-medium text-foreground">+ {s.label}</span>
                    {s.steps.some((st) => st.condition) ? ` · only when ${s.steps.map((st) => describeRule(st.condition, fieldLabel)).filter(Boolean).join(" / ")}` : ""}
                  </span>
                ))
              ) : (
                <span className="text-xs text-subtle">Standard routes, no extra stages</span>
              )}
            </div>
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

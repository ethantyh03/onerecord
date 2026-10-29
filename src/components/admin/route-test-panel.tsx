"use client";

import { useMemo } from "react";
import type { ApprovalStep, FieldDef, FieldValue } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { useNow } from "@/lib/selectors";
import { buildRoute, expectedCompletion } from "@/lib/engine/routing";
import { IVD_CONSUMABLE_CATEGORY } from "@/config/default-config";
import { IllustrativeMarker, Notice, PersonAvatar, Tag, formatSgtDay } from "@/components/common";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FieldLabel, NativeSelect, roleLabel } from "./shared";
import { pendingEntityName } from "./bu-template";

export interface RouteTestState {
  domainId: string;
  buId: string;
  values: Record<string, FieldValue>;
}

/** Sensible starting values for the fields that drive conditional steps. */
export const ROUTE_TEST_DEFAULTS: Record<string, FieldValue> = {
  category: IVD_CONSUMABLE_CATEGORY,
  creditLimit: 80000,
  suppliesRegulated: "Yes",
  changesCreditTerms: "Yes",
  productGroup: "A",
};

/** Fields referenced by a domain's step conditions (these are the ones worth testing). */
function conditionFields(fields: FieldDef[], keys: string[]): FieldDef[] {
  const out: FieldDef[] = [];
  for (const k of keys) {
    const f = fields.find((x) => x.key === k);
    if (f && !out.includes(f)) out.push(f);
  }
  return out;
}

export function RouteTestPanel({ state, onChange }: { state: RouteTestState; onChange: (s: RouteTestState) => void }) {
  const config = useSandbox((s) => s.config);
  const nowIso = useNow();

  const domain = config.domains.find((d) => d.id === state.domainId) ?? config.domains[0];
  const bu = config.businessUnits.find((b) => b.id === state.buId);

  /** Configured BUs plus any entity people belong to that has no BU config yet (e.g. a newly joined business). */
  const buOptions = useMemo(() => {
    const configured = config.businessUnits.map((b) => ({ id: b.id, label: b.name, configured: true }));
    const known = new Set(configured.map((b) => b.id));
    const missing = [...new Set(config.people.map((p) => p.entity))]
      .filter((e) => !known.has(e))
      .map((e) => ({ id: e, label: `${pendingEntityName(e)} · not configured yet`, configured: false }));
    return [...configured, ...missing];
  }, [config.businessUnits, config.people]);

  const testFields = useMemo(() => {
    const keys = [...domain.stages, ...(bu?.extraStages ?? [])]
      .flatMap((s) => s.steps.map((st) => st.condition?.field))
      .filter((k): k is string => !!k);
    return conditionFields(domain.fields, keys);
  }, [domain, bu]);

  const data = useMemo(() => {
    const d: Record<string, FieldValue> = {};
    for (const f of testFields) d[f.key] = state.values[f.key] ?? ROUTE_TEST_DEFAULTS[f.key] ?? null;
    for (const f of domain.fields) if (f.type === "entity") d[f.key] = state.buId;
    return d;
  }, [testFields, state.values, state.buId, domain.fields]);

  const steps = useMemo(
    () => buildRoute({ domain, bu, data, people: config.people }),
    [domain, bu, data, config.people],
  );
  const stages = useMemo(() => {
    const map = new Map<number, ApprovalStep[]>();
    for (const s of steps) map.set(s.stageIndex, [...(map.get(s.stageIndex) ?? []), s]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list);
  }, [steps]);
  const buStageIds = new Set((bu?.extraStages ?? []).map((s) => s.id));
  const expected = expectedCompletion(steps, nowIso, config.sla);
  const people = config.people;

  return (
    <section
      aria-labelledby="route-test-title"
      className="panel overflow-hidden"
      data-testid="admin-route-test"
    >
      <header className="flex min-h-11 items-start border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <h2 id="route-test-title" className="panel-title">
            Test a route
          </h2>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Pick a request type and business unit to see who would approve it, live from the current config.
          </p>
        </div>
      </header>

      <div className="space-y-3 px-4 py-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <FieldLabel htmlFor="rt-domain">Request type</FieldLabel>
            <NativeSelect
              id="rt-domain"
              value={domain.id}
              onChange={(e) => onChange({ ...state, domainId: e.target.value })}
              data-testid="admin-route-test-domain"
            >
              {config.domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel htmlFor="rt-bu">Business unit</FieldLabel>
            <NativeSelect
              id="rt-bu"
              value={state.buId}
              onChange={(e) => onChange({ ...state, buId: e.target.value })}
              data-testid="admin-route-test-bu"
            >
              {buOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        {testFields.length ? (
          <div className="grid grid-cols-1 gap-2.5">
            {testFields.map((f) => {
              const v = data[f.key];
              const set = (val: FieldValue) => onChange({ ...state, values: { ...state.values, [f.key]: val } });
              return (
                <div key={f.key}>
                  <FieldLabel htmlFor={`rt-${f.key}`}>{f.label}</FieldLabel>
                  {f.options?.length ? (
                    <NativeSelect
                      id={`rt-${f.key}`}
                      value={v === null ? "" : String(v)}
                      onChange={(e) => set(e.target.value || null)}
                      data-testid={`admin-route-test-field-${f.key}`}
                    >
                      <option value="">Not filled in</option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input
                      id={`rt-${f.key}`}
                      inputMode={f.type === "number" ? "numeric" : undefined}
                      value={v === null ? "" : String(v)}
                      onChange={(e) => set(e.target.value === "" ? null : f.type === "number" ? Number(e.target.value.replace(/[^\d.]/g, "")) || 0 : e.target.value)}
                      data-testid={`admin-route-test-field-${f.key}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {!bu ? (
          <Notice size="sm" tone="warn" lead="BU not configured yet — ask MDM to add it." data-testid="admin-route-test-unconfigured">
            Until then each step goes to the first person who holds the role.
          </Notice>
        ) : null}
      </div>

      <ol className="border-t border-border px-4 pt-3 pb-1" data-testid="admin-route-test-result" aria-label="Resulting route">
        {stages.map((list, i) => {
          const first = list[0];
          const fromBu = buStageIds.has(first.stageId);
          return (
            <li key={first.stageId + i} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 border-b border-border pb-2.5 not-first:pt-2.5 last:border-b-0">
              <span aria-hidden className={cn("num pt-px text-sm font-semibold", fromBu ? "text-foreground" : "text-subtle")}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[0.8125rem] font-semibold text-foreground">{first.stageLabel}</span>
                  {list.length > 1 ? (
                    <span className="text-xs text-muted-foreground">{first.stageMode === "parallel" ? "in parallel" : "one after another"}</span>
                  ) : null}
                  {fromBu ? <Tag>{bu?.id} rule</Tag> : null}
                </div>
                <ul className="mt-1.5 space-y-2">
                  {list.map((s) => {
                    const person = people.find((p) => p.id === s.assigneeId);
                    return (
                      <li key={s.id} className="min-w-0" data-testid={`admin-route-test-step-${s.id}`}>
                        <div className="flex items-center gap-2">
                          <PersonAvatar person={person} size="sm" away={person?.outOfOffice} />
                          <div className="min-w-0 flex-1 leading-tight">
                            <div className="truncate text-[0.8125rem] font-medium text-foreground">{person?.name ?? "Unassigned"}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {roleLabel(s.role)} · {s.label.replace(/^[^—]+—\s*/, "")}
                            </div>
                          </div>
                        </div>
                        {s.addedBecause || s.originalAssigneeId ? (
                          <div className="mt-1 space-y-0.5 pl-8 text-xs leading-snug text-secondary-foreground">
                            {s.addedBecause?.split("; ").map((r) => (
                              <p key={r}>{r}</p>
                            ))}
                            {s.originalAssigneeId ? (
                              <p>Delegate for {people.find((p) => p.id === s.originalAssigneeId)?.name ?? s.originalAssigneeId}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          Expected live if submitted now: <span className="num font-semibold text-foreground">{formatSgtDay(expected)}</span>
        </span>
        <IllustrativeMarker label="Preview only · nothing is submitted" />
      </footer>
    </section>
  );
}

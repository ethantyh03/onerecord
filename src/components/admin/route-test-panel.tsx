"use client";

import { useMemo } from "react";
import { AlertTriangle, CalendarClock, FlaskConical, Route } from "lucide-react";
import type { ApprovalStep, FieldDef, FieldValue } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { useNow } from "@/lib/selectors";
import { buildRoute, expectedCompletion, MDM_STAGE_ID } from "@/lib/engine/routing";
import { IVD_CONSUMABLE_CATEGORY } from "@/config/default-config";
import { PersonAvatar, formatSgtDay } from "@/components/common";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Chip, FieldLabel, NativeSelect, roleLabel } from "./shared";
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
      className="overflow-hidden rounded-xl border border-border bg-card shadow-raised"
      data-testid="admin-route-test"
    >
      <header className="flex items-start gap-2.5 border-b border-border bg-primary-soft/60 px-4 py-3">
        <Route className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <h2 id="route-test-title" className="text-[0.9375rem] font-semibold text-foreground">
            Test a route
          </h2>
          <p className="text-xs text-muted-foreground">Pick a request type and business unit to see who would approve it, live from the current config.</p>
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
          <div
            className="flex gap-2 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-[0.8125rem] text-warn-ink"
            data-testid="admin-route-test-unconfigured"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-semibold">BU not configured yet — ask MDM to add it.</span> Until then each step goes to the first
              person who holds the role, which is how Marcus&rsquo;s requests got misrouted.
            </p>
          </div>
        ) : null}
      </div>

      <ol className="space-y-0 border-t border-border px-4 py-3" data-testid="admin-route-test-result" aria-label="Resulting route">
        {stages.map((list, i) => {
          const first = list[0];
          const fromBu = buStageIds.has(first.stageId);
          const isMdm = first.stageId === MDM_STAGE_ID;
          return (
            <li key={first.stageId + i} className="relative pb-3 pl-7 last:pb-0">
              {i < stages.length - 1 ? <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-border-strong" /> : null}
              <span
                aria-hidden
                className={cn(
                  "absolute top-0.5 left-0 inline-flex size-[23px] items-center justify-center rounded-full border text-[0.6875rem] font-semibold tabular-nums",
                  fromBu ? "border-primary bg-primary text-primary-foreground" : isMdm ? "border-border-strong bg-muted text-foreground" : "border-primary/30 bg-primary-soft text-primary",
                )}
              >
                {i + 1}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.8125rem] font-semibold text-foreground">{first.stageLabel}</span>
                {list.length > 1 ? <Chip>{first.stageMode === "parallel" ? "in parallel" : "one after another"}</Chip> : null}
                {fromBu ? <Chip tone="brand">{bu?.id} rule</Chip> : null}
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {list.map((s) => {
                  const person = people.find((p) => p.id === s.assigneeId);
                  return (
                    <li key={s.id} className="rounded-lg border border-border bg-background px-2.5 py-1.5" data-testid={`admin-route-test-step-${s.id}`}>
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
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {s.addedBecause?.split("; ").map((r) => (
                            <Chip key={r} tone={fromBu ? "brand" : "warn"} className="h-auto py-0.5 whitespace-normal">
                              {r}
                            </Chip>
                          ))}
                          {s.originalAssigneeId ? (
                            <Chip tone="neutral">Delegate for {people.find((p) => p.id === s.originalAssigneeId)?.name ?? s.originalAssigneeId}</Chip>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-3.5" aria-hidden />
          Expected live if submitted now: <span className="font-semibold text-foreground">{formatSgtDay(expected)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <FlaskConical className="size-3" aria-hidden /> Preview only · nothing is submitted
        </span>
      </footer>
    </section>
  );
}

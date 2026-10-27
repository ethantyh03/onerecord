"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, Lock, Paperclip, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { DomainConfig, FieldDef, FieldValue, MdmRequest } from "@/lib/types";
import { isEmptyValue, isFieldVisible } from "@/lib/engine/conditions";
import { useSandbox } from "@/lib/store";
import { buLabel, useCurrentPerson } from "@/lib/selectors";
import { canSeeSensitive } from "@/lib/engine/masking";
import { cn } from "@/lib/utils";
import { MaskedValue, SapCode } from "@/components/common";
import { Button } from "@/components/ui/button";
import { countryName } from "./tracker-utils";

function plainValue(f: FieldDef, v: FieldValue | undefined, bu: (id: string) => string): string {
  if (isEmptyValue(v)) return "—";
  if (f.type === "country") return countryName(String(v));
  if (f.type === "entity") return bu(String(v));
  if (typeof v === "number") return v.toLocaleString("en-SG");
  return String(v);
}

/** Request data grouped by the form's sections. Sensitive fields go through MaskedValue (Finance / MDM can reveal; logged). */
export function RequestDataCard({ request, domain }: { request: MdmRequest; domain: DomainConfig | undefined }) {
  const config = useSandbox((s) => s.config);
  const bu = (id: string) => buLabel({ config }, id);
  const ai = new Set(request.aiFilledKeys ?? []);

  const fields = (domain?.fields ?? []).filter((f) => isFieldVisible(f, request.data));
  const known = new Set(fields.map((f) => f.key));
  // Values with no field definition (e.g. the config changed after submission) are still shown.
  const extras = Object.keys(request.data).filter((k) => !known.has(k) && !(domain?.fields ?? []).some((f) => f.key === k));

  const sections = new Map<string, FieldDef[]>();
  for (const f of fields) {
    const key = f.section ?? "Details";
    sections.set(key, [...(sections.get(key) ?? []), f]);
  }
  const sensitiveFields = fields.filter((f) => f.sensitive && !isEmptyValue(request.data[f.key]));
  const hasSensitive = sensitiveFields.length > 0;

  // One-click reveal for Finance / MDM. Tied to the viewer: switching persona masks everything again, and switching
  // back does not silently re-show values that were revealed under another seat.
  const person = useCurrentPerson();
  const allowed = canSeeSensitive(person);
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  if (revealedFor !== null && revealedFor !== person?.id) setRevealedFor(null);
  const revealedAll = allowed && !!person && revealedFor === person.id;

  function revealAll() {
    if (!person || !allowed || !hasSensitive) return;
    const labels = sensitiveFields.map((f) => f.label).join(", ");
    // One audit entry naming every field shown (the store falls back to the text when no single field matches).
    useSandbox.getState().logSensitiveReveal(request.id, labels);
    setRevealedFor(person.id);
    toast("View recorded in the audit trail", { description: `${person.name} viewed ${labels} on ${request.id}.` });
  }

  return (
    <section
      id="request-data"
      className="scroll-mt-20 overflow-hidden rounded-xl border bg-card shadow-raised"
      aria-labelledby="data-heading"
      data-testid="request-data"
    >
      <div className="flex flex-col gap-2 border-b border-border px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 id="data-heading" className="text-base font-semibold text-foreground">
            Request data
          </h2>
          <p className="text-sm text-muted-foreground">
            What {domain ? `the ${domain.label.toLowerCase()} form` : "the form"} captured, with the SAP B1 field each value lands in.
          </p>
        </div>
        {hasSensitive ? (
          <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
            {allowed ? (
              <Button
                variant={revealedAll ? "outline" : "default"}
                size="sm"
                onClick={revealedAll ? () => setRevealedFor(null) : revealAll}
                data-testid="reveal-all-sensitive"
              >
                {revealedAll ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                {revealedAll ? "Hide credit & bank values" : "Show credit & bank values (logged)"}
              </Button>
            ) : (
              <span className="inline-flex h-7 items-center gap-1.5 text-xs font-medium text-secondary-foreground" data-testid="sensitive-locked">
                <Lock aria-hidden className="size-3.5" />
                Credit &amp; bank values: Finance and MDM only
              </span>
            )}
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border-strong bg-background px-2.5 py-1 text-xs text-secondary-foreground">
              <Lock aria-hidden className="size-3.5" />
              Role-enforced in prototype; production: restricted SharePoint list + Entra ID
            </span>
          </div>
        ) : null}
      </div>

      <div className="divide-y divide-border">
        {[...sections.entries()].map(([section, list]) => (
          <div key={section} className="grid gap-x-6 gap-y-1 px-5 py-4 lg:grid-cols-[11rem_minmax(0,1fr)]">
            <h3 className="pt-1 text-sm font-semibold text-foreground">{section}</h3>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {list.map((f) => {
                const v = request.data[f.key];
                return (
                  <div key={f.key} className="min-w-0" data-testid={`field-${f.key}`}>
                    <dt className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {f.label}
                      {f.sapField ? <span className="font-mono text-[0.6875rem] text-muted-foreground/80">{f.sapField}</span> : null}
                      {ai.has(f.key) ? (
                        <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary-soft px-1 text-[0.625rem] font-medium text-accent-foreground">
                          <Sparkles aria-hidden className="size-2.5" />
                          from pasted text
                        </span>
                      ) : null}
                    </dt>
                    <dd className={cn("mt-0.5 text-sm break-words text-foreground", isEmptyValue(v) && "text-muted-foreground")}>
                      {f.sensitive && revealedAll && !isEmptyValue(v) ? (
                        <span className="num font-mono text-[0.8125rem] tracking-tight text-foreground" data-revealed="true">
                          {typeof v === "number" ? v.toLocaleString("en-SG") : String(v)}
                        </span>
                      ) : f.sensitive ? (
                        <MaskedValue value={v} requestId={request.id} fieldKey={f.key} />
                      ) : f.type === "file" && !isEmptyValue(v) ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Paperclip aria-hidden className="size-3.5 text-muted-foreground" />
                          {String(v)}
                        </span>
                      ) : f.key === "existingCode" && !isEmptyValue(v) ? (
                        <SapCode code={String(v)} />
                      ) : (
                        plainValue(f, v, bu)
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
        {extras.length ? (
          <div className="grid gap-x-6 gap-y-1 px-5 py-4 lg:grid-cols-[11rem_minmax(0,1fr)]">
            <h3 className="pt-1 text-sm font-semibold text-foreground">Other values</h3>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {extras.map((k) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 text-sm break-words text-foreground">{isEmptyValue(request.data[k]) ? "—" : String(request.data[k])}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** One-card summary of the duplicate check decision. */
export function DuplicateDecisionCard({ request, domain }: { request: MdmRequest; domain: DomainConfig | undefined }) {
  const dd = request.duplicateDecision;
  const tone = !dd ? "ok" : dd.choice === "override" ? "warn" : "ok";
  const choice = !dd
    ? null
    : dd.choice === "extend"
      ? `Extend the existing record to ${request.entity}`
      : dd.choice === "use_existing"
        ? "Use the existing record"
        : "Create a new record anyway";
  return (
    <section className="rounded-xl border bg-card px-5 py-4 shadow-raised" data-testid="duplicate-decision" aria-labelledby="dup-heading">
      <h2 id="dup-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Copy aria-hidden className="size-4 text-muted-foreground" />
        Duplicate check
      </h2>
      {dd ? (
        <div className="mt-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{dd.matchName}</span>
            <SapCode code={dd.matchCode} />
            <span
              className={cn(
                "num inline-flex h-5 items-center rounded-full border px-2 text-[0.6875rem] font-semibold",
                dd.score >= 0.9 ? "border-stuck/30 bg-stuck-soft text-stuck-ink" : "border-warn/45 bg-warn-soft text-warn-ink",
              )}
            >
              {Math.round(dd.score * 100)}% match
            </span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {dd.reasons.map((r) => (
              <li key={r} className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-xs text-secondary-foreground">
                {r}
              </li>
            ))}
          </ul>
          <p className={cn("text-sm font-medium", tone === "warn" ? "text-warn-ink" : "text-ok-ink")}>Decision: {choice}</p>
          {dd.choice === "override" ? (
            <p className="border-l-2 border-warn/60 pl-2.5 text-sm text-secondary-foreground italic">
              “{dd.justification ?? "No justification given"}” · flagged to MDM and logged
            </p>
          ) : dd.choice === "extend" ? (
            <p className="text-sm text-secondary-foreground">One customer, one record: SAP B1 keeps a single code shared by every entity.</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {domain?.dupCheck ? "No likely duplicates were found when the request was submitted." : "Not needed for this request type."}
        </p>
      )}
    </section>
  );
}

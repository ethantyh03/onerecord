"use client";

import { useState } from "react";
import { ClipboardPaste, Eye, EyeOff, Lock, Paperclip } from "lucide-react";
import { toast } from "sonner";
import type { DomainConfig, FieldDef, FieldValue, MdmRequest } from "@/lib/types";
import { isEmptyValue, isFieldVisible } from "@/lib/engine/conditions";
import { useSandbox } from "@/lib/store";
import { buLabel, useCurrentPerson } from "@/lib/selectors";
import { canSeeSensitive } from "@/lib/engine/masking";
import { cn } from "@/lib/utils";
import { MaskedValue, SapCode, StatusText } from "@/components/common";
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
    // Bring the new audit row on screen, so "every view is logged" can be shown without scrolling.
    window.setTimeout(() => {
      const rows = document.querySelectorAll<HTMLElement>('[data-testid^="audit-event-"]');
      const last = rows[rows.length - 1];
      if (!last || last.getBoundingClientRect().bottom <= window.innerHeight - 16) return;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      last.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
    }, 120);
  }

  return (
    <section
      id="request-data"
      className="panel scroll-mt-20 overflow-hidden"
      aria-labelledby="data-heading"
      data-testid="request-data"
    >
      <div className="panel-header flex-col items-start py-2.5 md:flex-row md:items-center">
        <div className="min-w-0">
          <h2 id="data-heading" className="panel-title">
            Request data
          </h2>
          <p className="text-sm leading-5 text-muted-foreground">
            What {domain ? `the ${domain.label.toLowerCase()} form` : "the form"} captured, with the SAP B1 field each value lands in.
          </p>
        </div>
        {hasSensitive ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
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
            <span className="w-full text-xs leading-4 text-subtle md:w-auto md:max-w-[34ch] md:text-right">
              Role-enforced in prototype; production: restricted SharePoint list + Entra ID
            </span>
          </div>
        ) : null}
      </div>

      <div className="divide-y divide-border">
        {[...sections.entries()].map(([section, list]) => (
          <div key={section} className="grid gap-x-6 gap-y-1 px-4 py-4 lg:grid-cols-[11rem_minmax(0,1fr)]">
            <h3 className="pt-0.5 text-sm font-semibold text-foreground">{section}</h3>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {list.map((f) => {
                const v = request.data[f.key];
                return (
                  <div key={f.key} className="min-w-0" data-testid={`field-${f.key}`}>
                    <dt className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {f.label}
                      {f.sapField ? <span className="mono-id text-xs text-subtle">{f.sapField}</span> : null}
                      {ai.has(f.key) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-subtle">
                          <ClipboardPaste aria-hidden className="size-3" />
                          from pasted text
                        </span>
                      ) : null}
                    </dt>
                    <dd className={cn("mt-0.5 text-sm break-words text-foreground", isEmptyValue(v) && "text-muted-foreground")}>
                      {f.sensitive && revealedAll && !isEmptyValue(v) ? (
                        <span className="num text-sm font-medium text-foreground" data-revealed="true">
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
          <div className="grid gap-x-6 gap-y-1 px-4 py-4 lg:grid-cols-[11rem_minmax(0,1fr)]">
            <h3 className="pt-0.5 text-sm font-semibold text-foreground">Other values</h3>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {extras.map((k) => (
                <div key={k} className="min-w-0">
                  <dt className="mono-id text-[0.8125rem] text-muted-foreground">{k}</dt>
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
    <section className="panel overflow-hidden" data-testid="duplicate-decision" aria-labelledby="dup-heading">
      <div className="panel-header">
        <h2 id="dup-heading" className="panel-title">
          Duplicate check
        </h2>
      </div>
      {dd ? (
        <div className="space-y-2.5 px-4 py-3.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-foreground">{dd.matchName}</span>
            <SapCode code={dd.matchCode} />
          </div>
          {/* The matcher's readout: score in the state's ink, then its reasons as plain text (no chips). */}
          <p className="text-[0.8125rem] leading-5">
            <span className={cn("num font-semibold", dd.score >= 0.9 ? "text-stuck-ink" : "text-warn-ink")}>
              {Math.round(dd.score * 100)}% match
            </span>
            <span className="text-muted-foreground">
              {dd.reasons.map((r) => (
                <span key={r}>
                  <span aria-hidden className="px-1.5 text-subtle">
                    ·
                  </span>
                  {r}
                </span>
              ))}
            </span>
          </p>
          <StatusText tone={tone === "warn" ? "warn" : "ok"} className="text-sm whitespace-normal">
            Decision: {choice}
          </StatusText>
          {dd.choice === "override" ? (
            <p className="text-sm leading-snug text-secondary-foreground">
              “{dd.justification ?? "No justification given"}” · flagged to MDM and logged
            </p>
          ) : dd.choice === "extend" ? (
            <p className="text-sm text-secondary-foreground">One customer, one record: SAP B1 keeps a single code shared by every entity.</p>
          ) : null}
        </div>
      ) : (
        <p className="px-4 py-3.5 text-sm text-muted-foreground">
          {domain?.dupCheck ? "No likely duplicates were found when the request was submitted." : "Not needed for this request type."}
        </p>
      )}
    </section>
  );
}

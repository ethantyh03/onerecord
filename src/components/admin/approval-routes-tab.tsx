"use client";

import { useState } from "react";
import { Lock, Plus, RotateCcw, Save } from "lucide-react";
import type { DomainConfig, StageDef } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StageEditor, newStage } from "./stage-editor";
import { deepClone, useSaveConfig } from "./shared";

function summarise(domain: DomainConfig, before: StageDef[], after: StageDef[]): string {
  const stepsOf = (stages: StageDef[]) => new Map(stages.flatMap((s) => s.steps.map((st) => [st.id, { ...st, stage: s.id }] as const)));
  const a = stepsOf(before);
  const b = stepsOf(after);
  const parts: string[] = [];
  const added = [...b.values()].filter((s) => !a.has(s.id));
  const removed = [...a.values()].filter((s) => !b.has(s.id));
  const edited = [...b.values()].filter((s) => a.has(s.id) && JSON.stringify(a.get(s.id)) !== JSON.stringify(s));
  if (added.length) parts.push(`added ${added.map((s) => `“${s.label}”`).join(", ")}`);
  if (removed.length) parts.push(`removed ${removed.map((s) => `“${s.label}”`).join(", ")}`);
  if (edited.length) parts.push(`edited ${edited.length} step${edited.length > 1 ? "s" : ""}`);
  const stageIdsBefore = new Set(before.map((s) => s.id));
  const newStages = after.filter((s) => !stageIdsBefore.has(s.id));
  if (newStages.length) parts.push(`new stage ${newStages.map((s) => `“${s.label}”`).join(", ")}`);
  const modeChanged = after.filter((s) => before.find((x) => x.id === s.id && x.mode !== s.mode));
  if (modeChanged.length) parts.push(`${modeChanged.map((s) => s.label).join(", ")} now ${modeChanged[0].mode}`);
  return `Approval route · ${domain.label}: ${parts.length ? parts.join("; ") : "stage details updated"}`;
}

export function ApprovalRoutesTab() {
  const config = useSandbox((s) => s.config);
  const save = useSaveConfig();
  const [domainId, setDomainId] = useState(config.domains[0]?.id ?? "");
  const domain = config.domains.find((d) => d.id === domainId) ?? config.domains[0];
  const draftKey = `${domain.id}@${config.version}`;
  const [draft, setDraft] = useState<{ key: string; stages: StageDef[] }>(() => ({ key: draftKey, stages: deepClone(domain.stages) }));
  // Re-base the draft when the domain or the live config version changes.
  const stages = draft.key === draftKey ? draft.stages : deepClone(domain.stages);
  const setStages = (next: StageDef[]) => setDraft({ key: draftKey, stages: next });
  const dirty = JSON.stringify(stages) !== JSON.stringify(domain.stages);
  const invalid = stages.some((s) => !s.label.trim() || s.steps.length === 0 || s.steps.some((st) => !st.label.trim()));

  function onSave() {
    if (!dirty || invalid) return;
    const next = { ...config, domains: config.domains.map((d) => (d.id === domain.id ? { ...d, stages: deepClone(stages) } : d)) };
    save(next, summarise(domain, domain.stages, stages));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Approval routes</h2>
        <p className="text-[0.8125rem] text-muted-foreground">
          Stages run top to bottom. Steps in an &ldquo;all at once&rdquo; stage go out together; conditional steps join only when their rule holds.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Request type">
        {config.domains.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={d.id === domain.id}
            onClick={() => setDomainId(d.id)}
            data-testid={`admin-routes-domain-${d.id}`}
            className={cn(
              "h-8 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors",
              d.id === domain.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div>
        {stages.map((stage, i) => (
          <StageEditor
            key={stage.id}
            stage={stage}
            index={i}
            fields={domain.fields}
            testIdPrefix={`admin-route-${domain.id}`}
            onChange={(s) => setStages(stages.map((x, j) => (j === i ? s : x)))}
            onRemove={stages.length > 1 ? () => setStages(stages.filter((_, j) => j !== i)) : undefined}
          />
        ))}
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong bg-muted/40 px-4 py-3 text-[0.8125rem]">
          <Lock className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-medium text-foreground">MDM final check</span>
          <span className="text-muted-foreground">Always last, added automatically. Business-unit stages run just before it.</span>
        </div>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-2.5 shadow-float backdrop-blur">
        <Button variant="outline" size="sm" onClick={() => setStages([...stages, newStage(domain.id, "New stage")])} data-testid={`admin-route-${domain.id}-add-stage`}>
          <Plus /> Add stage
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {invalid ? "Every stage and step needs a name." : dirty ? "Unsaved changes" : "Matches the live config"}
          </span>
          <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setStages(deepClone(domain.stages))}>
            <RotateCcw /> Discard
          </Button>
          <Button size="sm" disabled={!dirty || invalid} onClick={onSave} data-testid="admin-routes-save">
            <Save /> Save route
          </Button>
        </div>
      </div>
    </div>
  );
}

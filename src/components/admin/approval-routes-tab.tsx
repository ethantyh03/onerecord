"use client";

import { useState } from "react";
import { Lock, Plus, RotateCcw, Save } from "lucide-react";
import type { DomainConfig, StageDef } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { StageEditor, newStage } from "./stage-editor";
import { deepClone, DomainSwitch, SectionHeader, useSaveConfig } from "./shared";

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
      <SectionHeader
        title="Approval routes"
        description={
          <>
            Stages run top to bottom. Steps in an &ldquo;all at once&rdquo; stage go out together; conditional steps join only when their rule
            holds.
          </>
        }
      />

      <DomainSwitch domains={config.domains} value={domain.id} onChange={setDomainId} testIdPrefix="admin-routes-domain" />

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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-border px-4 py-3 text-[0.8125rem]">
          <Lock className="size-4 shrink-0 text-subtle" aria-hidden />
          <span className="font-medium text-foreground">MDM final check</span>
          <span className="text-muted-foreground">Always last, added automatically. Business-unit stages run just before it.</span>
        </div>
      </div>

      {/* Floats over the route while it scrolls, so it is an overlay: popover surface + the one crisp shadow. */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-strong bg-popover px-4 py-2.5 shadow-float">
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

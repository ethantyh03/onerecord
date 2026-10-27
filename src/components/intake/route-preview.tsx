"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Clock, Plus, TriangleAlert } from "lucide-react";
import type { ApprovalStep, Person } from "@/lib/types";
import { COUNTRIES } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/engine/routing";
import { PersonAvatar } from "@/components/common";
import { cn } from "@/lib/utils";

export interface RoutePreviewProps {
  steps: ApprovalStep[];
  people: Person[];
  slaDays: number;
  /** Entity the request routes under when it has no business-unit config yet */
  unconfiguredEntity?: string;
}

interface Stage {
  index: number;
  label: string;
  mode: "parallel" | "sequential";
  steps: ApprovalStep[];
}

function stagesOf(steps: ApprovalStep[]): Stage[] {
  const map = new Map<number, Stage>();
  for (const s of steps) {
    const st = map.get(s.stageIndex) ?? { index: s.stageIndex, label: s.stageLabel, mode: s.stageMode, steps: [] };
    st.steps.push(s);
    map.set(s.stageIndex, st);
  }
  return [...map.values()].sort((a, b) => a.index - b.index);
}

function tzLabel(p: Person | undefined): string {
  const c = COUNTRIES.find((x) => x.code === p?.country);
  return c ? `${c.code} · ${c.utcOffset}` : "";
}

/** Live approval route: who approves, in parallel or in turn, each with the step SLA (final model P0-07). */
export function RoutePreview({ steps, people, slaDays, unconfiguredEntity }: RoutePreviewProps) {
  const reduce = useReducedMotion();
  const stages = stagesOf(steps);
  const personOf = (id: string) => people.find((p) => p.id === id);
  const added = steps.filter((s) => s.addedBecause);

  return (
    <div data-testid="route-preview" className="space-y-1">
      {unconfiguredEntity ? (
        <div className="mb-2.5 flex gap-2 rounded-lg border border-warn/50 bg-warn-soft px-3 py-2 text-[0.75rem] leading-snug text-warn-ink" data-testid="bu-not-configured">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            <strong>BU {unconfiguredEntity} not configured yet — ask MDM to add it.</strong> Until then, approvers come from the shared group roles.
          </span>
        </div>
      ) : null}
      <LayoutGroup>
        {stages.map((stage, si) => {
          const parallel = stage.mode === "parallel" && stage.steps.length > 1;
          const isMdm = stage.steps.every((s) => s.role === "mdm");
          return (
            <motion.div layout={!reduce} key={`${stage.label}-${si}`} className="relative">
              {si > 0 ? (
                <div className="flex justify-center py-0.5" aria-hidden>
                  <ChevronDown className="size-4 text-border-strong" />
                </div>
              ) : null}
              <div className={cn("rounded-xl border px-2 pt-1.5 pb-2", isMdm ? "border-primary/30 bg-primary-soft/50" : "border-border bg-background")}>
                <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
                  <span className="truncate text-[0.75rem] font-semibold text-foreground">{stage.label}</span>
                  <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                    {parallel ? `${stage.steps.length} in parallel · ` : stage.steps.length > 1 ? "one after another · " : ""}
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Clock aria-hidden className="size-2.5" />
                      {slaDays} business day{slaDays === 1 ? "" : "s"}
                      {stage.steps.length > 1 ? " each" : ""}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  <AnimatePresence mode="popLayout">
                    {stage.steps.map((s) => {
                      const p = personOf(s.assigneeId);
                      return (
                        <motion.div
                          layout={!reduce}
                          key={s.id}
                          data-testid={`route-step-${s.role}`}
                          initial={reduce ? false : { opacity: 0, scale: 0.92, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28 }}
                          className={cn(
                            "relative flex min-w-0 items-center gap-2 rounded-lg border bg-card px-2 py-1.5",
                            s.addedBecause ? "border-primary/50 shadow-[0_0_0_3px_var(--primary-soft)]" : "border-border",
                          )}
                          title={s.label}
                        >
                          <PersonAvatar person={p} size="sm" />
                          <p className="min-w-0 flex-1 truncate text-[0.8125rem] leading-tight">
                            <span className="font-semibold">{p?.name ?? s.assigneeId}</span>
                            <span className="text-muted-foreground"> · {ROLE_LABELS[s.role] ?? s.role}</span>
                          </p>
                          <span className="shrink-0 text-[0.6875rem] text-muted-foreground">{tzLabel(p)}</span>
                          {s.originalAssigneeId && s.originalAssigneeId !== s.assigneeId ? (
                            <span className="absolute -top-1.5 right-1.5 rounded-full bg-warn-soft px-1.5 text-[0.5625rem] font-medium text-warn-ink">
                              delegate
                            </span>
                          ) : null}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          );
        })}
      </LayoutGroup>

      <ul className="space-y-1 pt-1.5" aria-label="Steps added by rules">
        <AnimatePresence>
          {added.map((s) => (
            <motion.li
              key={s.id}
              data-testid="route-added-because"
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.1 }}
              className="flex items-start gap-1.5 rounded-lg bg-primary-soft px-2.5 py-1.5 text-[0.75rem] leading-snug text-primary"
            >
              <Plus aria-hidden className="mt-0.5 size-3 shrink-0" />
              <span>
                <strong className="font-semibold">{ROLE_LABELS[s.role] ?? s.role} added</strong> · {s.addedBecause}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import type { ApprovalStep, Person } from "@/lib/types";
import { COUNTRIES } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/engine/routing";
import { Notice, PersonAvatar, StateGlyph, StatusText } from "@/components/common";
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

/**
 * Live approval route: who approves, in parallel or in turn, each with the step SLA (final model P0-07).
 *
 * Drawn as the route itself, not as boxes: one 1px spine runs down the avatar column from stage to stage; each
 * stage is a hollow node on it (not started yet) with its name and timing, and its approvers hang off the spine as
 * rows. A step added by a rule says why on a quiet line under its own row.
 */
export function RoutePreview({ steps, people, slaDays, unconfiguredEntity }: RoutePreviewProps) {
  const reduce = useReducedMotion();
  const stages = stagesOf(steps);
  const personOf = (id: string) => people.find((p) => p.id === id);

  return (
    <div data-testid="route-preview">
      {unconfiguredEntity ? (
        <Notice
          tone="warn"
          size="sm"
          data-testid="bu-not-configured"
          className="mb-3"
          lead={`BU ${unconfiguredEntity} not configured yet — ask MDM to add it.`}
        >
          Until then, approvers come from the shared group roles.
        </Notice>
      ) : null}
      <LayoutGroup>
        <ol aria-label="Approval stages">
          {stages.map((stage, si) => {
            const parallel = stage.mode === "parallel" && stage.steps.length > 1;
            const last = si === stages.length - 1;
            return (
              <motion.li layout={!reduce ? "position" : false} key={`${stage.label}-${si}`} className="relative">
                {/* The spine: from this stage's node down to the next stage's node (or, on the last stage, to its
                    last approver). Avatars and nodes sit on top of it with a card-coloured gap. */}
                <span
                  aria-hidden
                  className={cn("absolute top-3 left-[11.5px] w-px bg-border-strong", last ? "bottom-[18px]" : "-bottom-3")}
                />
                {/* Stage name and timing; in a narrow rail the timing drops under the name rather than cutting it off.
                    The node stays on the first line, on the spine. */}
                <div className="relative flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <StateGlyph tone="waiting" className="bg-card" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 py-1 text-xs leading-4">
                    <span className="font-semibold text-foreground">{stage.label}</span>
                    <span className="ml-auto text-subtle">
                      {parallel ? `${stage.steps.length} in parallel · ` : stage.steps.length > 1 ? "one after another · " : ""}
                      <span className="whitespace-nowrap">
                        {slaDays} business day{slaDays === 1 ? "" : "s"}
                        {stage.steps.length > 1 ? " each" : ""}
                      </span>
                    </span>
                  </span>
                </div>
                <ul className={cn("pt-0.5", !last && "pb-2.5")}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {stage.steps.map((s) => {
                      const p = personOf(s.assigneeId);
                      const delegated = !!s.originalAssigneeId && s.originalAssigneeId !== s.assigneeId;
                      return (
                        <motion.li
                          layout={!reduce ? "position" : false}
                          key={s.id}
                          data-testid={`route-step-${s.role}`}
                          initial={reduce ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                          className="relative flex min-w-0 items-start gap-2.5 py-1.5"
                          title={s.label}
                        >
                          <PersonAvatar person={p} size="sm" className="ring-2 ring-card" />
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="truncate text-[0.8125rem] leading-5">
                              <span className="font-semibold text-foreground">{p?.name ?? s.assigneeId}</span>
                              <span className="text-muted-foreground"> · {ROLE_LABELS[s.role] ?? s.role}</span>
                            </p>
                            {s.addedBecause ? (
                              <motion.p
                                data-testid="route-added-because"
                                initial={reduce ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.22, ease: "easeOut", delay: 0.08 }}
                                className="mt-0.5 flex items-start gap-1 text-xs leading-4 text-muted-foreground"
                              >
                                <Plus aria-hidden className="mt-px size-3 shrink-0 text-subtle" />
                                <span>
                                  <span className="font-medium text-foreground">{ROLE_LABELS[s.role] ?? s.role} added</span> ·{" "}
                                  {s.addedBecause}
                                </span>
                              </motion.p>
                            ) : null}
                          </div>
                          {delegated ? (
                            <StatusText tone="warn" size="sm" className="mt-1">
                              delegate
                            </StatusText>
                          ) : null}
                          <span className="mt-1 shrink-0 text-xs leading-4 text-subtle">{tzLabel(p)}</span>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </motion.li>
            );
          })}
        </ol>
      </LayoutGroup>
    </div>
  );
}

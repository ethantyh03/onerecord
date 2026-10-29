"use client";

import { nanoid } from "nanoid";
import { ArrowDown, Filter, Plus, Trash2 } from "lucide-react";
import type { Condition, ConditionOp, FieldDef, StageDef, StepDef } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NativeSelect, OP_LABELS, STEP_ROLES, roleLabel } from "./shared";

const OPS: ConditionOp[] = ["equals", "in", "gt", "isEmpty", "notEmpty"];

export function newStep(stageId: string, role: StepDef["role"] = "qa_ra"): StepDef {
  return { id: `${stageId}-${nanoid(5).toLowerCase()}`, label: `${roleLabel(role)} review`, role };
}

export function newStage(prefix: string, label = "", mode: StageDef["mode"] = "sequential"): StageDef {
  const id = `${prefix}-${nanoid(5).toLowerCase()}`;
  return { id, label, mode, steps: [newStep(id)] };
}

function valueToText(c: Condition): string {
  if (Array.isArray(c.value)) return c.value.join(", ");
  return c.value === undefined ? "" : String(c.value);
}

function textToValue(op: ConditionOp, text: string): Condition["value"] {
  if (op === "isEmpty" || op === "notEmpty") return undefined;
  if (op === "in") return text.split(",").map((s) => s.trim()).filter(Boolean);
  if (op === "gt") {
    const n = Number(text.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && text.trim() !== "" ? n : text;
  }
  return text;
}

/** "Only when <field> <op> <value>" builder for one step. */
export function ConditionEditor({
  condition,
  fields,
  onChange,
  testIdPrefix,
}: {
  condition: Condition | undefined;
  fields: FieldDef[];
  onChange: (c: Condition | undefined) => void;
  testIdPrefix?: string;
}) {
  if (!condition) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        onClick={() => onChange({ field: fields[0]?.key ?? "", op: "equals", value: "" })}
        data-testid={testIdPrefix ? `${testIdPrefix}-add-condition` : undefined}
      >
        <Filter /> Only when…
      </Button>
    );
  }
  const field = fields.find((f) => f.key === condition.field);
  const needsValue = condition.op !== "isEmpty" && condition.op !== "notEmpty";
  const text = valueToText(condition);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
      <span className="text-muted-foreground">Only when</span>
      <NativeSelect
        size="sm"
        className="w-auto min-w-[9rem] max-w-[13rem]"
        value={condition.field}
        aria-label="Condition field"
        onChange={(e) => onChange({ ...condition, field: e.target.value })}
      >
        {fields.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        size="sm"
        className="w-auto min-w-[8rem]"
        value={condition.op}
        aria-label="Condition operator"
        onChange={(e) => {
          const op = e.target.value as ConditionOp;
          onChange({ field: condition.field, op, ...(op === "isEmpty" || op === "notEmpty" ? {} : { value: textToValue(op, text) }) });
        }}
      >
        {OPS.map((op) => (
          <option key={op} value={op}>
            {OP_LABELS[op]}
          </option>
        ))}
      </NativeSelect>
      {needsValue ? (
        condition.op === "equals" && field?.options?.length ? (
          <NativeSelect
            size="sm"
            className="w-auto min-w-[8rem] max-w-[16rem]"
            value={text}
            aria-label="Condition value"
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
          >
            <option value="">Choose…</option>
            {field.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <Input
            className="h-7 w-auto min-w-[8rem] flex-1 bg-card text-[0.8125rem]"
            value={text}
            aria-label="Condition value"
            placeholder={condition.op === "in" ? "Comma-separated values" : condition.op === "gt" ? "e.g. 50000" : "Value"}
            onChange={(e) => onChange({ ...condition, value: textToValue(condition.op, e.target.value) })}
          />
        )
      ) : null}
      <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove condition" onClick={() => onChange(undefined)}>
        <Trash2 />
      </Button>
    </div>
  );
}

/** Editable card for one approval stage: label, parallel/sequential, steps with role + optional condition. */
export function StageEditor({
  stage,
  index,
  fields,
  onChange,
  onRemove,
  testIdPrefix,
  isLast,
}: {
  stage: StageDef;
  index: number;
  /** Domain fields for conditions; omit to hide the condition builder (BU extra stages). */
  fields?: FieldDef[];
  onChange: (s: StageDef) => void;
  onRemove?: () => void;
  testIdPrefix: string;
  isLast?: boolean;
}) {
  const setStep = (i: number, step: StepDef) => onChange({ ...stage, steps: stage.steps.map((s, j) => (j === i ? step : s)) });
  const removeStep = (i: number) => onChange({ ...stage, steps: stage.steps.filter((_, j) => j !== i) });

  return (
    <div className="relative">
      <div className="panel overflow-hidden" data-testid={`${testIdPrefix}-stage-${index}`}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <span className="num w-5 shrink-0 text-sm font-semibold text-subtle">{index + 1}</span>
          <Input
            value={stage.label}
            placeholder="Stage name, e.g. Regulatory pre-check"
            aria-label="Stage name"
            className="h-8 max-w-sm flex-1 font-medium"
            onChange={(e) => onChange({ ...stage, label: e.target.value })}
            data-testid={`${testIdPrefix}-stage-${index}-label`}
          />
          <div className="inline-flex rounded-lg border border-border bg-canvas p-0.5" role="radiogroup" aria-label="Stage mode">
            {(["parallel", "sequential"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={stage.mode === m}
                onClick={() => onChange({ ...stage, mode: m })}
                data-testid={`${testIdPrefix}-stage-${index}-mode-${m}`}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[0.8125rem] font-medium transition-colors",
                  stage.mode === m ? "bg-secondary text-foreground ring-1 ring-border-strong" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "parallel" ? "All at once" : "One after another"}
              </button>
            ))}
          </div>
          {onRemove ? (
            <Button type="button" variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={onRemove}>
              <Trash2 /> Remove stage
            </Button>
          ) : null}
        </div>

        <ol className="divide-y divide-border">
          {stage.steps.map((step, i) => (
            <li key={step.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-start">
              <div className="min-w-0 space-y-2">
                <Input
                  value={step.label}
                  aria-label="Step label"
                  placeholder="What the approver checks"
                  onChange={(e) => setStep(i, { ...step, label: e.target.value })}
                  data-testid={`${testIdPrefix}-stage-${index}-step-${i}-label`}
                />
                {fields ? (
                  <ConditionEditor
                    condition={step.condition}
                    fields={fields}
                    testIdPrefix={`${testIdPrefix}-stage-${index}-step-${i}`}
                    onChange={(c) => {
                      const next: StepDef = { ...step };
                      if (c) next.condition = c;
                      else delete next.condition;
                      setStep(i, next);
                    }}
                  />
                ) : null}
              </div>
              <NativeSelect
                value={step.role}
                aria-label="Approver role"
                onChange={(e) => setStep(i, { ...step, role: e.target.value as StepDef["role"] })}
                data-testid={`${testIdPrefix}-stage-${index}-step-${i}-role`}
              >
                {STEP_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </NativeSelect>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove step ${step.label}`}
                disabled={stage.steps.length <= 1}
                onClick={() => removeStep(i)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>
        <div className="border-t border-border px-4 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...stage, steps: [...stage.steps, newStep(stage.id)] })}
            data-testid={`${testIdPrefix}-stage-${index}-add-step`}
          >
            <Plus /> Add step
          </Button>
        </div>
      </div>
      {!isLast ? (
        <div className="flex justify-center py-1.5 text-muted-foreground" aria-hidden>
          <ArrowDown className="size-4" />
        </div>
      ) : null}
    </div>
  );
}

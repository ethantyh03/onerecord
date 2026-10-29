"use client";

import type { ComponentProps, ReactNode } from "react";
import { useCallback } from "react";
import { ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";
import type { AppConfig, Condition, ConditionOp, Person, RoleId } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/engine/routing";
import { cn } from "@/lib/utils";

/** Roles an admin can assign per business unit, in the order the form shows them. */
export const ASSIGNABLE_ROLES: RoleId[] = [
  "bu_head",
  "sales_manager",
  "business_support",
  "finance",
  "finance_director",
  "financial_controller",
  "procurement",
  "qa_ra",
  "mdm",
  "admin",
];

/** Roles a person can hold (People & delegates tab). */
export const PERSON_ROLES: RoleId[] = ["requestor", ...ASSIGNABLE_ROLES];

/** Roles an approval step can be routed to (MDM is always appended by the engine). */
export const STEP_ROLES: RoleId[] = [
  "bu_head",
  "sales_manager",
  "business_support",
  "finance",
  "finance_director",
  "financial_controller",
  "procurement",
  "qa_ra",
];

export const OP_LABELS: Record<ConditionOp, string> = {
  equals: "equals",
  in: "is one of",
  gt: "is greater than",
  isEmpty: "is empty",
  notEmpty: "is filled in",
};

export const ADMIN_TABS = [
  { id: "business-units", label: "Business units" },
  { id: "routes", label: "Approval routes" },
  { id: "fields", label: "Fields & rules" },
  { id: "people", label: "People & delegates" },
  { id: "sla", label: "SLA" },
  { id: "history", label: "Change history" },
] as const;
export type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

export function roleLabel(role: RoleId): string {
  return ROLE_LABELS[role] ?? role;
}

/** Plain-language condition, e.g. "Category is one of IVD reagent, Medical device". */
export function describeRule(c: Condition | undefined, fieldLabel?: (key: string) => string): string {
  if (!c) return "";
  const name = fieldLabel?.(c.field) ?? c.field;
  const v = Array.isArray(c.value) ? c.value.join(", ") : c.value === undefined ? "" : String(c.value);
  switch (c.op) {
    case "isEmpty":
    case "notEmpty":
      return `${name} ${OP_LABELS[c.op]}`;
    case "gt":
      return `${name} > ${typeof c.value === "number" ? c.value.toLocaleString("en-SG") : v}`;
    default:
      return `${name} ${OP_LABELS[c.op]} ${v}`;
  }
}

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** People sorted so holders of `role` come first. */
export function peopleForRole(people: Person[], role: RoleId): { holders: Person[]; others: Person[] } {
  const holders = people.filter((p) => p.roles.includes(role));
  const others = people.filter((p) => !p.roles.includes(role)).sort((a, b) => a.name.localeCompare(b.name));
  return { holders, others };
}

/**
 * Save a new config version and show the standard toast. Returns the new version number.
 */
export function useSaveConfig(): (next: AppConfig, summary: string) => number {
  const updateConfig = useSandbox((s) => s.updateConfig);
  return useCallback(
    (next: AppConfig, summary: string) => {
      const before = useSandbox.getState().config.version;
      updateConfig(next, summary);
      const after = useSandbox.getState().config.version;
      if (after > before) {
        toast.success(`Config v${after} live · in-flight requests keep the version they started with`, {
          description: summary,
        });
      } else {
        toast.error("Nothing was saved", { description: "The configuration was incomplete, so the live version is unchanged." });
      }
      return after;
    },
    [updateConfig],
  );
}

/** Styled native <select>: reliable to drive in screen recordings and Playwright. */
export function NativeSelect({
  className,
  children,
  size = "default",
  ...props
}: Omit<ComponentProps<"select">, "size"> & { size?: "sm" | "default" }) {
  return (
    <span className={cn("relative inline-flex w-full min-w-0", className)}>
      <select
        {...props}
        className={cn(
          "w-full min-w-0 appearance-none rounded-lg border border-input bg-card pr-8 pl-2.5 text-sm text-foreground transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          size === "sm" ? "h-7 text-[0.8125rem]" : "h-8",
        )}
      >
        {children}
      </select>
      <ChevronDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}

/** Options for a person picker: role holders first, then everyone else. `nameOnly` drops the job title (show it beside the select instead). */
export function PersonOptions({ people, role, nameOnly = false }: { people: Person[]; role: RoleId; nameOnly?: boolean }) {
  const { holders, others } = peopleForRole(people, role);
  const text = (p: Person) => (nameOnly ? p.name : `${p.name} · ${p.title}`);
  return (
    <>
      {holders.length ? (
        <optgroup label={`${roleLabel(role)}s`}>
          {holders.map((p) => (
            <option key={p.id} value={p.id}>
              {text(p)}
            </option>
          ))}
        </optgroup>
      ) : null}
      <optgroup label="Everyone else">
        {others.map((p) => (
          <option key={p.id} value={p.id}>
            {text(p)}
          </option>
        ))}
      </optgroup>
    </>
  );
}

export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[0.8125rem] font-medium text-foreground">
        {children}
      </label>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** A tab's own heading row: section title (panel-title scale) and one line of purpose, controls on the right. */
export function SectionHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="panel-title">{title}</h2>
        {description ? <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/**
 * Request-type switcher (Item / Customer / Vendor ...): a segmented control in a canvas well, the selected
 * segment raised. role="tab" keeps the existing test hooks and keyboard semantics.
 */
export function DomainSwitch({
  domains,
  value,
  onChange,
  testIdPrefix,
}: {
  domains: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border bg-canvas p-0.5" role="tablist" aria-label="Request type">
      {domains.map((d) => {
        const on = d.id === value;
        return (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(d.id)}
            data-testid={`${testIdPrefix}-${d.id}`}
            className={cn(
              "h-7 rounded-md px-3 text-[0.8125rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              on ? "bg-secondary text-foreground ring-1 ring-border-strong" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

/** Small chip used for roles, modes and reasons. */
export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "warn" | "ok" | "stuck" | "phase2";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-border-strong bg-secondary text-secondary-foreground",
    brand: "border-foreground/25 bg-primary-soft text-foreground",
    warn: "border-warn/30 bg-warn-soft text-warn-ink",
    ok: "border-ok/30 bg-ok-soft text-ok-ink",
    stuck: "border-stuck/30 bg-stuck-soft text-stuck-ink",
    phase2: "border-dashed border-phase2 bg-phase2-soft/60 text-phase2-ink",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 rounded-sm border px-1.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

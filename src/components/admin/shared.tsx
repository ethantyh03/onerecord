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

/** Options for a person picker: role holders first, then everyone else. */
export function PersonOptions({ people, role }: { people: Person[]; role: RoleId }) {
  const { holders, others } = peopleForRole(people, role);
  return (
    <>
      {holders.length ? (
        <optgroup label={`${roleLabel(role)}s`}>
          {holders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.title}
            </option>
          ))}
        </optgroup>
      ) : null}
      <optgroup label="Everyone else">
        {others.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.title}
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

/** Small rounded chip used for roles, modes and reasons. */
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
    neutral: "border-border bg-muted text-secondary-foreground",
    brand: "border-primary/20 bg-primary-soft text-primary",
    warn: "border-warn/30 bg-warn-soft text-warn-ink",
    ok: "border-ok/30 bg-ok-soft text-ok-ink",
    stuck: "border-stuck/30 bg-stuck-soft text-stuck-ink",
    phase2: "border-dashed border-phase2 bg-phase2-soft/60 text-phase2-ink",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 rounded-full border px-2 text-[0.6875rem] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

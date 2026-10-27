"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Lock, Paperclip, Sparkles, X } from "lucide-react";
import type { FieldDef, FieldValue } from "@/lib/types";
import { COUNTRIES } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EntityOption } from "./intake-logic";

const SELECT_CLASS =
  "h-9 w-full min-w-0 appearance-none rounded-lg border border-input bg-card bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8 pl-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23667788' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

const MARKETS = COUNTRIES.map((c) => c.code);

export interface FieldControlProps {
  field: FieldDef;
  value: FieldValue | undefined;
  required: boolean;
  error?: string;
  /** Filled by paste-to-fill and not edited since */
  aiFilled: boolean;
  /** Changes on every paste-to-fill apply, so the highlight replays */
  fillEpoch: number;
  /** Position among the AI-filled fields, for a short stagger */
  fillOrder: number;
  /** Required, empty, and the user has been told what's missing */
  pulse: boolean;
  entityOptions: EntityOption[];
  onChange: (key: string, value: FieldValue) => void;
  onBlur: (key: string) => void;
  /** Sample file name for file fields (simulated upload) */
  sampleFileName?: string;
}

export function FieldControl({
  field,
  value,
  required,
  error,
  aiFilled,
  fillEpoch,
  fillOrder,
  pulse,
  entityOptions,
  onChange,
  onBlur,
  sampleFileName,
}: FieldControlProps) {
  const reduce = useReducedMotion();
  const fileRef = useRef<HTMLInputElement>(null);
  const id = `fld-${field.key}`;
  const str = value === null || value === undefined ? "" : String(value);
  const len = str.trim().length;
  const over = !!field.maxLength && len > field.maxLength;
  const near = !!field.maxLength && !over && len >= field.maxLength * 0.85;
  const invalid = !!error;
  const testId = `field-${field.key}`;
  const common = {
    id,
    "data-testid": testId,
    "aria-invalid": invalid || undefined,
    "aria-describedby": `${id}-hint`,
    onBlur: () => onBlur(field.key),
  };

  let control: React.ReactNode;
  switch (field.type) {
    case "select":
    case "country":
    case "entity": {
      const opts: { value: string; label: string }[] =
        field.type === "country"
          ? COUNTRIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))
          : field.type === "entity"
            ? entityOptions.map((e) => ({ value: e.id, label: e.label }))
            : (field.options ?? []).map((o) => ({ value: o, label: field.key === "productGroup" ? productGroupLabel(o) : o }));
      if (str && !opts.some((o) => o.value === str)) opts.push({ value: str, label: str });
      control = (
        <select
          {...common}
          value={str}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={cn(SELECT_CLASS, !str && "text-muted-foreground")}
          style={{ backgroundImage: CHEVRON }}
        >
          <option value="">Choose…</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value} className="text-foreground">
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "textarea":
      control = (
        <Textarea
          {...common}
          value={str}
          rows={2}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="min-h-[4.25rem] bg-card"
        />
      );
      break;
    case "file":
      control = (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="sr-only"
            data-testid={testId}
            id={id}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onChange(field.key, f.name);
              e.target.value = "";
            }}
          />
          {str ? (
            <span className="inline-flex h-9 max-w-full items-center gap-2 rounded-lg border border-ok/40 bg-ok-soft px-2.5 text-sm text-ok-ink">
              <Paperclip aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{str}</span>
              <button
                type="button"
                aria-label="Remove attachment"
                className="rounded p-0.5 hover:bg-ok/15"
                onClick={() => onChange(field.key, "")}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ) : (
            <>
              <Button type="button" variant="outline" className="h-9" onClick={() => fileRef.current?.click()}>
                <Paperclip aria-hidden />
                Attach file
              </Button>
              {sampleFileName ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 text-primary"
                  data-testid={`${testId}-sample`}
                  onClick={() => onChange(field.key, sampleFileName)}
                >
                  Attach sample certificate
                </Button>
              ) : null}
            </>
          )}
        </div>
      );
      break;
    default: {
      const isMarkets = field.key === "countries";
      const selected = new Set(
        str
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      );
      control = (
        <div className="space-y-1.5">
          <Input
            {...common}
            type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
            inputMode={field.type === "number" ? "decimal" : undefined}
            value={str}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={placeholderFor(field)}
            className="h-9 bg-card"
            autoComplete="off"
          />
          {isMarkets ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Toggle markets">
              {MARKETS.map((m) => {
                const on = selected.has(m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    data-testid={`${testId}-${m}`}
                    onClick={() => {
                      const next = new Set(selected);
                      if (on) next.delete(m);
                      else next.add(m);
                      onChange(field.key, MARKETS.filter((x) => next.has(x)).join(", "));
                    }}
                    className={cn(
                      "h-6 rounded-full border px-2.5 text-xs font-medium transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }
  }

  return (
    <div
      className={cn(
        "relative isolate -mx-2.5 rounded-xl px-2.5 py-2",
        field.type === "textarea" || field.key === "itemName" || field.key === "customerName" || field.key === "reason"
          ? "sm:col-span-2"
          : undefined,
      )}
    >
      {aiFilled && !reduce ? (
        <motion.span
          key={`fill-${fillEpoch}`}
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-primary-soft"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.4, delay: 0.4 + Math.min(fillOrder, 12) * 0.07, ease: "easeOut" }}
        />
      ) : null}
      {pulse ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-warn"
          initial={{ opacity: 0.2 }}
          animate={reduce ? { opacity: 0.8 } : { opacity: [0.25, 0.95, 0.25] }}
          transition={reduce ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      <div className="mb-1.5 flex min-h-5 items-center gap-1.5">
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-foreground">
          {field.label}
          {required ? (
            <span className="ml-0.5 text-stuck" aria-hidden>
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (required)</span> : null}
        </label>
        {field.sensitive ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-px text-[0.6875rem] text-muted-foreground"
            title="After you submit, only Finance and MDM see this value; everyone else sees ••••"
          >
            <Lock aria-hidden className="size-3" />
            Finance &amp; MDM only
          </span>
        ) : null}
        {aiFilled ? (
          <motion.span
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + Math.min(fillOrder, 12) * 0.07, type: "spring", stiffness: 420, damping: 22 }}
            className="inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-1.5 py-px text-[0.6875rem] font-semibold text-primary"
            title="Filled by paste-to-fill. Check it, then edit if needed."
          >
            <Sparkles aria-hidden className="size-3" />
            AI
          </motion.span>
        ) : null}
        {pulse ? <span className="text-[0.6875rem] font-medium text-warn-ink">Needed</span> : null}
      </div>
      {control}
      <div id={`${id}-hint`} className="mt-1 flex items-start justify-between gap-3 text-[0.75rem] leading-snug">
        <div className="min-w-0">
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : field.helpText ? (
            <p className="text-muted-foreground">{field.helpText}</p>
          ) : null}
          {field.sapField ? (
            <p className="mt-0.5 font-mono text-[0.6875rem] text-muted-foreground/90">
              → SAP: {field.sapField}
              {field.maxLength ? ` · max ${field.maxLength}` : ""}
            </p>
          ) : null}
        </div>
        {field.maxLength && field.type !== "select" ? (
          <span
            className={cn(
              "num shrink-0 pt-px text-[0.6875rem] tabular-nums",
              over ? "font-semibold text-destructive" : near ? "text-warn-ink" : "text-muted-foreground/80",
            )}
            aria-label={`${len} of ${field.maxLength} characters`}
          >
            {len}/{field.maxLength}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function productGroupLabel(o: string): string {
  return o === "A" ? "A · IVD reagents & test kits" : o === "B" ? "B · Lab consumables" : o === "C" ? "C · Instruments & equipment" : o;
}

function placeholderFor(f: FieldDef): string | undefined {
  switch (f.key) {
    case "regLicenceNo":
      return "e.g. DE0012345";
    case "customerName":
      return "e.g. National University Hospital";
    case "taxId":
      return "e.g. 198500123K";
    case "creditLimit":
      return "e.g. 80,000";
    case "countries":
      return "e.g. SG, MY";
    default:
      return undefined;
  }
}

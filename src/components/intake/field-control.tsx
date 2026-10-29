"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, Lock, Paperclip, X } from "lucide-react";
import type { FieldDef, FieldValue } from "@/lib/types";
import { COUNTRIES } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StateGlyph, StatusText } from "@/components/common";
import { cn } from "@/lib/utils";
import type { EntityOption } from "./intake-logic";

/* Native select styled like the console Input: raised surface in dark, 4px, signal focus ring. The chevron is an
   icon laid over it (no hard-coded colour in a data URI), so it follows the theme. */
const SELECT_CLASS =
  "h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent pr-8 pl-2.5 text-sm text-foreground outline-none transition-colors hover:border-subtle focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 dark:bg-secondary";

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
  /** Position among the auto-filled fields, for a short stagger */
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
        <div className="relative">
          <select
            {...common}
            value={str}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={cn(SELECT_CLASS, !str && "text-subtle")}
          >
            <option value="">Choose…</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value} className="text-foreground">
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-subtle" />
        </div>
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
          className="min-h-[4.25rem]"
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
            // Attached: the file name on a plain line (the green clip says it is there), no tinted chip.
            <span className="inline-flex h-9 max-w-full items-center gap-2 text-sm text-foreground">
              <Paperclip aria-hidden className="size-4 shrink-0 text-ok" />
              <span className="truncate">{str}</span>
              <button
                type="button"
                aria-label="Remove attachment"
                className="rounded-sm p-1 text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
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
            className="h-9"
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
                      "h-7 min-w-10 rounded-sm border px-2 text-xs font-semibold transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      on
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border-strong text-muted-foreground hover:bg-secondary hover:text-foreground",
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
        "relative isolate -mx-2.5 rounded-md px-2.5 py-2",
        field.type === "textarea" || field.key === "itemName" || field.key === "customerName" || field.key === "reason"
          ? "sm:col-span-2"
          : // Long option labels ("Lab consumable – IVD medical device"): full row until the form panel is wide.
            field.key === "category"
            ? "sm:col-span-2 @3xl:col-span-1"
            : undefined,
      )}
    >
      {aiFilled && !reduce ? (
        <motion.span
          key={`fill-${fillEpoch}`}
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-signal-soft"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.4, delay: 0.4 + Math.min(fillOrder, 12) * 0.07, ease: "easeOut" }}
        />
      ) : null}
      {/* Label row: the label and this field's state ("Needed") on the left; quiet provenance and access markers on
          the right. No chips and no outlined box around the field. */}
      <div className="mb-1.5 flex min-h-5 items-center gap-2.5">
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-foreground">
          {field.label}
          {required ? (
            <span className="ml-0.5 text-muted-foreground" aria-hidden>
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (required)</span> : null}
        </label>
        {pulse ? (
          // Still needed: amber status text that blinks twice when the user is told, then holds (no endless loop).
          <motion.span
            className="inline-flex"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 0.25, 1] }}
            transition={reduce ? undefined : { duration: 1.4, ease: "easeInOut" }}
          >
            <StatusText tone="warn" size="sm">
              Needed
            </StatusText>
          </motion.span>
        ) : null}
        {field.sensitive || aiFilled ? (
          <span className="ml-auto flex min-w-0 items-center gap-3">
            {field.sensitive ? (
              <span
                className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-subtle"
                title="After you submit, only Finance and MDM see this value; everyone else sees ••••"
              >
                <Lock aria-hidden className="size-3" />
                Finance &amp; MDM only
              </span>
            ) : null}
            {aiFilled ? (
              // Filled by paste-to-fill (rules + a cached example; no AI model runs in phase 1). A quiet marker with the
              // live-data square: this value came from the pasted text just now, so check it.
              <Tooltip>
                <TooltipTrigger
                  render={
                    <motion.span
                      data-autofilled="true"
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.15 + Math.min(fillOrder, 12) * 0.07, duration: 0.2, ease: "easeOut" }}
                      className="inline-flex cursor-default items-center gap-1.5 rounded-[2px] text-xs whitespace-nowrap text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                  }
                >
                  <StateGlyph tone="live" size="sm" />
                  Auto-filled
                </TooltipTrigger>
                <TooltipContent>Filled from the pasted text. Check it, then edit if needed.</TooltipContent>
              </Tooltip>
            ) : null}
          </span>
        ) : null}
      </div>
      {control}
      <div id={`${id}-hint`} className="mt-1 flex items-start justify-between gap-3 text-xs leading-4">
        <div className="min-w-0 space-y-0.5">
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : field.helpText ? (
            <p className="text-muted-foreground">{field.helpText}</p>
          ) : null}
          {field.sapField ? (
            // Where the value lands in SAP B1: the field key is a machine value, so it alone is mono.
            <p className="text-subtle">
              → SAP: <span className="mono-id text-muted-foreground">{field.sapField}</span>
              {field.maxLength ? ` · max ${field.maxLength}` : ""}
            </p>
          ) : null}
        </div>
        {field.maxLength && field.type !== "select" ? (
          <span
            className={cn(
              "num shrink-0 text-xs",
              over ? "font-semibold text-destructive" : near ? "text-warn-ink" : "text-subtle",
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

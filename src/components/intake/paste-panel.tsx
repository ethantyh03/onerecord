"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ClipboardPaste, Mail, ShieldCheck, Sparkles, Table2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { IntakeExtraction } from "@/lib/extract-cache";
import { PASTE_EXAMPLES } from "@/lib/extract-cache";

export interface PastePanelProps {
  text: string;
  onTextChange: (t: string) => void;
  onExample: (kind: keyof typeof PASTE_EXAMPLES) => void;
  onApply: () => void;
  result: IntakeExtraction | null;
  /** Label of the request type the result filled */
  resultDomainLabel?: string;
  /** Required fields still empty after the fill */
  missingLabels: string[];
}

export function PastePanel({ text, onTextChange, onExample, onApply, result, resultDomainLabel, missingLabels }: PastePanelProps) {
  const reduce = useReducedMotion();
  return (
    <section aria-labelledby="paste-title" className="rounded-xl border border-border bg-card shadow-raised">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 id="paste-title" className="flex items-center gap-2 text-base font-semibold">
            <ClipboardPaste aria-hidden className="size-4.5 text-primary" />
            Paste to fill
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Paste the email or spreadsheet row you would have sent to MDM. OneRecord fills what it can and shows what is still missing.
          </p>
        </div>
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-primary/25 bg-primary-soft px-2.5 text-[0.75rem] font-medium text-primary">
          <Sparkles aria-hidden className="size-3.5" />
          AI extraction · cached for demo · production: in-tenant LLM
        </span>
      </div>

      <div className="px-5 pt-3">
        <Textarea
          data-testid="paste-input"
          aria-label="Text to extract from"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Hi MDM team, pls create item code for…"
          rows={4}
          className="max-h-44 min-h-24 bg-background font-mono text-[0.8125rem] leading-relaxed"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 pt-3 pb-4">
        <span className="text-[0.8125rem] text-muted-foreground">Try an example:</span>
        <Button type="button" variant="outline" size="sm" data-testid="paste-example-amy" onClick={() => onExample("amy")}>
          <Mail aria-hidden />
          {PASTE_EXAMPLES.amy.label}
        </Button>
        <Button type="button" variant="outline" size="sm" data-testid="paste-example-customer" onClick={() => onExample("customer")}>
          <Table2 aria-hidden />
          {PASTE_EXAMPLES.customer.label}
        </Button>
        <Button type="button" className="ml-auto h-9 px-3.5" data-testid="paste-apply" disabled={!text.trim()} onClick={onApply}>
          <WandSparkles aria-hidden />
          Fill the form
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {result ? (
          <motion.div
            key="result"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border bg-primary-soft/40 px-5 py-3.5" data-testid="paste-result">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-foreground">
                  Filled {result.filledKeys.length} field{result.filledKeys.length === 1 ? "" : "s"}
                  {resultDomainLabel ? <span className="font-normal text-muted-foreground"> on {resultDomainLabel}</span> : null}
                </span>
                <span
                  data-testid="paste-redactions"
                  className="inline-flex h-6 items-center gap-1.5 rounded-full border border-ok/35 bg-ok-soft px-2.5 text-[0.75rem] font-medium text-ok-ink"
                >
                  <ShieldCheck aria-hidden className="size-3.5" />
                  {result.redactions} sensitive value{result.redactions === 1 ? "" : "s"} removed before extraction
                </span>
                {result.source === "rules" ? (
                  <span className="inline-flex h-6 items-center rounded-full border border-border bg-card px-2.5 text-[0.75rem] text-muted-foreground">
                    Rules extraction (offline): not one of the cached demo inputs
                  </span>
                ) : null}
                {missingLabels.length ? (
                  <span className="inline-flex h-6 items-center rounded-full border border-warn/50 bg-warn-soft px-2.5 text-[0.75rem] font-medium text-warn-ink">
                    Still needed: {missingLabels.join(", ")}
                  </span>
                ) : null}
              </div>
              {result.insights.length ? (
                <ul className="mt-2.5 space-y-1">
                  {result.insights.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[0.8125rem] leading-snug text-foreground/90" data-testid={i === 0 ? "paste-insight" : undefined}>
                      <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

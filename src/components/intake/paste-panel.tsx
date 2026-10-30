"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronDown, CornerDownRight, Mail, ScanText, ShieldCheck, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Notice, StatusText } from "@/components/common";
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
  /** Request type currently open: picks the placeholder and which examples are offered */
  domainId?: string;
  /** Hide the text box and examples; the header and any fill result stay visible */
  collapsed?: boolean;
  onExpand?: () => void;
}

const PLACEHOLDER: Record<string, string> = {
  customer: "Hi MDM team, pls set up a new customer: hospital name, address, UEN, AP email…",
  vendor: "Hi MDM team, pls set up a new vendor: supplier name, UEN, bank details…",
  item: "Hi MDM team, pls create item code for…",
  costcentre: "Hi MDM team, pls open a cost centre for…",
  extend: "Hi MDM team, pls extend customer C-… to our entity…",
};
const DEFAULT_PLACEHOLDER = "Hi MDM team, pls create…";

/** Which built-in example fits which request type. With no type picked, both are offered. */
const EXAMPLE_FOR: Record<keyof typeof PASTE_EXAMPLES, string> = { amy: "item", customer: "customer" };
const EXAMPLE_ICON = { amy: Mail, customer: Table2 } as const;

export function PastePanel({
  text,
  onTextChange,
  onExample,
  onApply,
  result,
  resultDomainLabel,
  missingLabels,
  domainId,
  collapsed,
  onExpand,
}: PastePanelProps) {
  const reduce = useReducedMotion();
  const examples = (Object.keys(PASTE_EXAMPLES) as (keyof typeof PASTE_EXAMPLES)[]).filter(
    (k) => !domainId || EXAMPLE_FOR[k] === domainId,
  );
  return (
    <section
      aria-labelledby="paste-title"
      data-testid="paste-panel"
      data-collapsed={collapsed ? "true" : "false"}
      className="panel scroll-mt-24 overflow-hidden"
    >
      <div className={collapsed && !result ? "panel-header border-b-0" : "panel-header"}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h2 id="paste-title" className="panel-title">
            Paste to fill
          </h2>
          {/* How the fill works, as quiet meta after a hairline. */}
          <span className="border-l border-border-strong pl-3 text-xs leading-4 text-subtle">Rules-based extraction</span>
        </div>
        {collapsed ? (
          <Button type="button" variant="ghost" size="sm" className="shrink-0" data-testid="paste-expand" aria-expanded={false} onClick={onExpand}>
            <ChevronDown aria-hidden />
            {result ? "Paste again" : "Paste an email instead"}
          </Button>
        ) : null}
      </div>

      {collapsed ? null : (
        <div className="px-4 pt-3 pb-4">
          <p className="text-sm text-muted-foreground">
            Paste an email or spreadsheet row. Tesseract fills what it can and shows what is still missing.
          </p>
          <Textarea
            data-testid="paste-input"
            aria-label="Text to extract from"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={(domainId && PLACEHOLDER[domainId]) || DEFAULT_PLACEHOLDER}
            rows={4}
            className="mt-3 max-h-44 min-h-24 text-sm leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {examples.length ? <span className="text-[0.8125rem] text-muted-foreground">Sandbox samples:</span> : null}
            {examples.map((k) => {
              const Icon = EXAMPLE_ICON[k];
              return (
                <Button key={k} type="button" variant="outline" size="sm" data-testid={`paste-example-${k}`} onClick={() => onExample(k)}>
                  <Icon aria-hidden />
                  {PASTE_EXAMPLES[k].label}
                </Button>
              );
            })}
            <Button type="button" className="ml-auto h-9 px-3.5" data-testid="paste-apply" disabled={!text.trim()} onClick={onApply}>
              <ScanText aria-hidden />
              Fill the form
            </Button>
          </div>
        </div>
      )}

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
            {/* The fill report: what was filled, what was protected, what is still on you. Plain lines in the state's
                ink, facts separated by hairlines (no chips, no fill). */}
            <div className={collapsed ? "px-4 py-3.5" : "border-t border-border px-4 py-3.5"} data-testid="paste-result">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <span className="font-semibold text-foreground">
                  Filled <span className="num">{result.filledKeys.length}</span> field{result.filledKeys.length === 1 ? "" : "s"}
                  {resultDomainLabel ? <span className="font-normal text-muted-foreground"> on {resultDomainLabel}</span> : null}
                </span>
                <span className="border-l border-border-strong pl-4">
                  <StatusText data-testid="paste-redactions" tone="ok" icon={<ShieldCheck />}>
                    {result.redactions} sensitive value{result.redactions === 1 ? "" : "s"} removed before extraction
                  </StatusText>
                </span>
              </div>
              {missingLabels.length ? (
                <Notice tone="warn" size="sm" lead="Still needed:" className="mt-2">
                  {missingLabels.join(", ")}
                </Notice>
              ) : null}
              {result.insights.length ? (
                <ul className="mt-2.5 space-y-1">
                  {result.insights.map((line, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[0.8125rem] leading-5 text-foreground/90"
                      data-testid={i === 0 ? "paste-insight" : undefined}
                    >
                      <CornerDownRight aria-hidden className="mt-[3px] size-3.5 shrink-0 text-subtle" />
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

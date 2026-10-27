"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy, FileJson, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSandbox } from "@/lib/store";
import { useNow } from "@/lib/selectors";
import type { ApprovalStep, MdmRequest } from "@/lib/types";
import { bindApprovalCard, cardData } from "./card-json";

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;

function highlight(json: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of json.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(json.slice(last, at));
    if (m[1] && m[2]) {
      out.push(
        <span key={i++} className="text-[#0451a5] dark:text-[#9cdcfe]">
          {m[1]}
        </span>,
        m[2],
      );
    } else if (m[1]) {
      out.push(
        <span key={i++} className="text-[#a31515] dark:text-[#ce9178]">
          {m[1]}
        </span>,
      );
    } else {
      out.push(
        <span key={i++} className="text-[#098658] dark:text-[#b5cea8]">
          {m[0]}
        </span>,
      );
    }
    last = at + m[0].length;
  }
  if (last < json.length) out.push(json.slice(last));
  return out;
}

/** The real Adaptive Card JSON (integrations/teams/approval-card.json) with this request's values bound. */
export function CardJsonView({ request, step }: { request: MdmRequest; step: ApprovalStep }) {
  const config = useSandbox((s) => s.config);
  const prs = useSandbox((s) => s.prs);
  const now = useNow();
  const [copied, setCopied] = useState(false);
  const domain = config.domains.find((d) => d.id === request.domainId);

  const json = useMemo(() => {
    const data = cardData(request, step, { config, domain, prs, nowIso: now });
    return JSON.stringify(bindApprovalCard(data), null, 2);
  }, [request, step, config, domain, prs, now]);
  const nodes = useMemo(() => highlight(json), [json]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast.success("Card JSON copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy is blocked in this browser. Select the text instead.");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-raised">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <FileJson className="size-4 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">integrations/teams/approval-card.json</p>
          <p className="text-xs text-muted-foreground">
            Adaptive Card 1.5, bound with {request.id}&apos;s values · the same template the production flow posts to Teams
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={copy} data-testid="json-copy">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy JSON"}
        </Button>
      </div>
      <p className="flex items-start gap-2 border-b border-border bg-ok-soft/50 px-4 py-2 text-xs text-ok-ink">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Bank details, credit limits and payment terms are replaced with a mask before binding, so they never travel in the Teams
        message. Finance opens them in OneRecord, where each view is logged.
      </p>
      <pre
        data-testid="card-json"
        className="max-h-[560px] overflow-auto bg-[#fbfbfd] px-4 py-3 font-mono text-[12px] leading-[1.55] text-[#242424] dark:bg-[#1e1e1e] dark:text-[#d4d4d4]"
      >
        <code>{nodes}</code>
      </pre>
    </div>
  );
}

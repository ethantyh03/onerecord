"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
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
        <span key={i++} className="text-muted-foreground">
          {m[1]}
        </span>,
        m[2],
      );
    } else if (m[1]) {
      out.push(
        <span key={i++} className="text-foreground">
          {m[1]}
        </span>,
      );
    } else {
      out.push(
        <span key={i++} className="font-medium text-foreground">
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
    <div className="panel overflow-hidden">
      <div className="panel-header py-2.5">
        <div className="min-w-0 flex-1">
          <p className="mono-id text-sm font-medium text-foreground">integrations/teams/approval-card.json</p>
          <p className="text-[0.8125rem] leading-5 text-muted-foreground">
            Adaptive Card 1.5, bound with {request.id}&apos;s values · the same template the approval flow posts to Teams
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={copy} data-testid="json-copy">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy JSON"}
        </Button>
      </div>
      {/* A status line under the header (shield in the "verified" ink), not a tinted band. */}
      <p className="flex items-start gap-2 border-b border-border px-4 py-2.5 text-[0.8125rem] leading-5 text-secondary-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ok-ink" aria-hidden="true" />
        <span>
          <span className="font-medium text-ok-ink">
            Bank details, credit limits and payment terms are replaced with a mask before binding,
          </span>{" "}
          so they never travel in the Teams message. Finance opens them in Tesseract, where each view is logged.
        </span>
      </p>
      <pre
        data-testid="card-json"
        className="max-h-[560px] overflow-auto bg-canvas px-4 py-3 font-mono text-[12px] leading-[1.6] text-subtle scrollbar-thin [font-variant-ligatures:none]"
      >
        <code>{nodes}</code>
      </pre>
    </div>
  );
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, LogIn, LogOut, Send } from "lucide-react";
import { Phase2Badge, SapCode } from "@/components/common";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { assignSapCode } from "@/lib/engine/codes";
import { knownSapCodes } from "@/lib/seed";
import { toServiceLayerPayload } from "@/lib/engine/dtw";
import { canSeeSensitive, maskValue } from "@/lib/engine/masking";
import { useSandbox } from "@/lib/store";
import type { FieldValue } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isSensitiveColumn } from "../_lib/dtw-sim";
import { SapButton } from "./sap-ui";

export const SL_HOST = "https://<b1-server>:50000";

/** Replace sensitive values (bank, credit, payment terms) anywhere in a JSON body. */
export function maskPayload(value: unknown, sensitive: Set<string>, key?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => maskPayload(v, sensitive, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, maskPayload(v, sensitive, k)]));
  }
  if (key && isSensitiveColumn(key, sensitive) && value !== null && value !== undefined && value !== "") {
    return maskValue(value as FieldValue);
  }
  return value;
}

/** Minimal JSON syntax colouring for the payload viewer. */
function highlightJson(json: string): ReactNode[] {
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(json))) {
    if (m.index > last) out.push(json.slice(last, m.index));
    if (m[1] && m[2]) {
      out.push(
        <span key={i++} className="text-[#0b4f8a]">
          {m[1]}
        </span>,
        m[2],
      );
    } else if (m[1]) {
      out.push(
        <span key={i++} className="text-[#2f7a2f]">
          {m[1]}
        </span>,
      );
    } else if (m[3]) {
      out.push(
        <span key={i++} className="text-[#7a3fa0]">
          {m[3]}
        </span>,
      );
    } else if (m[4]) {
      out.push(
        <span key={i++} className="text-[#b45a00]">
          {m[4]}
        </span>,
      );
    }
    last = re.lastIndex;
  }
  if (last < json.length) out.push(json.slice(last));
  return out;
}

export function ServiceLayerView({
  requestId,
  onSelectRequest,
}: {
  requestId?: string;
  onSelectRequest: (id: string) => void;
}) {
  const requests = useSandbox((s) => s.requests);
  const domains = useSandbox((s) => s.config.domains);
  const people = useSandbox((s) => s.config.people);
  const personaId = useSandbox((s) => s.personaId);
  const sapRecords = useSandbox((s) => s.sapRecords);
  const reservedCodes = useSandbox((s) => s.reservedCodes);
  const person = people.find((p) => p.id === personaId);
  const privileged = canSeeSensitive(person);

  const eligible = useMemo(
    () =>
      requests
        .filter((r) => r.status === "mdm_review" || r.status === "created")
        .sort((a, b) => (a.status === b.status ? b.id.localeCompare(a.id) : a.status === "mdm_review" ? -1 : 1)),
    [requests],
  );
  const selected = eligible.find((r) => r.id === requestId) ?? eligible[0];
  const domain = selected ? domains.find((d) => d.id === selected.domainId) : undefined;

  const built = useMemo(() => {
    if (!selected || !domain) return null;
    try {
      // Same code source as the store's generateDtw: created code, then the code DTW reserved, then the next free one.
      const code =
        selected.sapCode ??
        reservedCodes[selected.id] ??
        assignSapCode(domain, selected, knownSapCodes({ sapRecords, requests, reservedCodes }, selected.id));
      const payload = toServiceLayerPayload(selected, domain, code);
      const sensitive = new Set<string>(domain.fields.filter((f) => f.sensitive && f.sapField).map((f) => f.sapField as string));
      const body = privileged ? payload.body : (maskPayload(payload.body, sensitive) as Record<string, unknown>);
      const codeState = selected.sapCode ? "created" : reservedCodes[selected.id] ? "reserved" : "provisional";
      return { code, payload, json: JSON.stringify(body, null, 2), codeState };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [selected, domain, sapRecords, requests, reservedCodes, privileged]);

  const [copied, setCopied] = useState(false);

  async function copy(json: string) {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed", { description: "Your browser blocked clipboard access." });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Phase2Badge label="Service Layer API" />
        <p className="min-w-0 flex-1 text-[11.5px] text-[#4a5d70]">
          Phase 2 replaces the manual DTW load with a direct REST call, built with an SAP partner. This is the exact request the flow
          would send for the selected record. Nothing is sent from the prototype.
        </p>
      </div>

      <label className="flex flex-wrap items-center gap-2 text-[11.5px] text-[#2c3e50]">
        <span className="w-28 shrink-0">Source request</span>
        <select
          value={selected?.id ?? ""}
          onChange={(e) => onSelectRequest(e.target.value)}
          disabled={eligible.length === 0}
          className="h-[22px] min-w-0 flex-1 border border-[#a9b7c5] bg-white px-1 text-[11.5px] outline-none focus:border-[#2f6db5] sm:max-w-md"
        >
          {eligible.length === 0 ? <option value="">No approved requests yet</option> : null}
          {eligible.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} · {r.title} {r.status === "created" ? `(in SAP as ${r.sapCode ?? "created"})` : "(waiting for MDM)"}
            </option>
          ))}
        </select>
      </label>

      {!selected ? (
        <p className="rounded-[3px] border border-dashed border-[#a9b7c5] bg-white px-4 py-6 text-center text-[11.5px] text-[#4a5d70]">
          Once a request clears its business approvals, its Service Layer payload appears here.
        </p>
      ) : built && "error" in built ? (
        <p className="rounded-[3px] border border-[#e5a29a] bg-[#fdf0ee] px-3 py-2 text-[12px] text-[#8a1c12]">
          Could not build the payload for {selected.id}: {built.error}
        </p>
      ) : built ? (
        <>
          <Call
            n={1}
            icon={<LogIn className="size-3.5" />}
            method="POST"
            url={`${SL_HOST}/b1s/v2/Login`}
            note="Returns SessionId and SessionTimeout: 30 (minutes idle), plus the B1SESSION and ROUTEID cookies every later call sends."
          >
            {highlightJson(JSON.stringify({ CompanyDB: "LIVES_PROD", UserName: "svc_onerecord", Password: "<from Azure Key Vault>" }, null, 2))}
          </Call>

          <Call
            n={2}
            icon={<Send className="size-3.5" />}
            method={built.payload.method}
            url={`${SL_HOST}${built.payload.path}`}
            headers={["Content-Type: application/json", "Cookie: B1SESSION=<SessionId>; ROUTEID=.node1"]}
            note={
              <>
                Creates <SapCode code={built.code} />
                {built.codeState === "reserved"
                  ? " (reserved when the DTW files were generated)"
                  : built.codeState === "provisional"
                    ? " (provisional: the number is reserved when the DTW files are generated)"
                    : ""}. Expected response: 201 Created.
                {privileged ? "" : " Sensitive values are masked for your role."}
              </>
            }
            action={
              <SapButton variant="secondary" onClick={() => copy(built.json)}>
                <Copy className="size-3.5" aria-hidden="true" />
                {copied ? "Copied" : "Copy JSON"}
              </SapButton>
            }
          >
            {highlightJson(built.json)}
          </Call>

          <Call n={3} icon={<LogOut className="size-3.5" />} method="POST" url={`${SL_HOST}/b1s/v2/Logout`} note="Returns 204 No Content. Always runs, even after an error." />

          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
            <ul className="space-y-1 rounded-[3px] border border-[#c3ced9] bg-white px-4 py-3 text-[11.5px] text-[#2c3e50]">
              <li className="flex gap-2">
                <KeyRound className="mt-0.5 size-3.5 shrink-0 text-[#5b6f83]" aria-hidden="true" />
                One integration user, credentials in Azure Key Vault. The approver&apos;s identity and the request ID travel in U_OneRecordRef,
                because B1 records the integration user as the creator.
              </li>
              <li className="pl-5.5">Business partners post with their addresses, contacts and bank rows in one $batch changeset, so a failed child row rolls the whole record back.</li>
              <li className="pl-5.5">The session expires after 30 idle minutes, so each flow run logs in, posts and logs out.</li>
              <li className="pl-5.5">Runs under one Power Automate Process licence (premium HTTP connector). Approvals stay on standard M365 licences.</li>
            </ul>
            <Tooltip>
              <TooltipTrigger render={<span tabIndex={0} className="inline-flex rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-[#2f6db5]" />}>
                <SapButton disabled aria-disabled="true">
                  <Send className="size-3.5" aria-hidden="true" />
                  Send to Service Layer
                </SapButton>
              </TooltipTrigger>
              <TooltipContent>Phase 2 — built with an SAP partner</TooltipContent>
            </Tooltip>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Call({
  n,
  icon,
  method,
  url,
  headers,
  note,
  action,
  children,
}: {
  n: number;
  icon: ReactNode;
  method: string;
  url: string;
  headers?: string[];
  note?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[3px] border border-[#8fa1b3] bg-white" aria-label={`Step ${n}: ${method} ${url}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#c3ced9] bg-gradient-to-b from-[#f4f7fa] to-[#e3e9ef] px-3 py-1.5">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#3c5a78] text-[10px] font-bold text-white">{n}</span>
        <span className="text-[#5b6f83]">{icon}</span>
        <code className="min-w-0 font-mono text-[11.5px] break-all text-[#14202c]">
          <span className={cn("mr-2 font-bold", method === "POST" ? "text-[#b45a00]" : "text-[#0b4f8a]")}>{method}</span>
          {url}
        </code>
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>
      {headers ? (
        <div className="border-b border-[#eef2f6] px-3 py-1 font-mono text-[10.5px] text-[#5b6f83]">
          {headers.map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>
      ) : null}
      {children ? (
        <pre className="max-h-[360px] overflow-auto bg-[#fbfcfd] px-3 py-2 font-mono text-[11px] leading-[1.6] text-[#1c2a39]">{children}</pre>
      ) : null}
      {note ? <p className="border-t border-[#eef2f6] px-3 py-1.5 text-[11px] text-[#4a5d70]">{note}</p> : null}
    </section>
  );
}

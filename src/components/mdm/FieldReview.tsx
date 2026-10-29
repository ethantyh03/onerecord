"use client";

import { Check, Lock, Paperclip, X } from "lucide-react";
import type { MdmRequest } from "@/lib/types";
import { MaskedValue, StatusText } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FieldReviewRow } from "./mdm-helpers";
import { Panel } from "./Panel";

function valueText(v: FieldReviewRow["value"]): string {
  if (v === null || v === undefined) return "—";
  return typeof v === "number" ? v.toLocaleString("en-SG") : String(v);
}

/** Paste-to-fill provenance: the value came from the requestor's pasted text and they confirmed it. */
function AutoFilledTag() {
  return (
    <span
      title="Filled by paste-to-fill, confirmed by the requestor"
      className="inline-flex h-5 shrink-0 items-center rounded-sm bg-secondary px-1.5 text-xs font-normal whitespace-nowrap text-secondary-foreground"
    >
      Auto-filled
    </span>
  );
}

/** (2) Field review: form field → SAP property → DB column → value → SDK 10.0 length check. */
export function FieldReview({ req, rows }: { req: MdmRequest; rows: FieldReviewRow[] }) {
  const ai = new Set(req.aiFilledKeys ?? []);
  const checked = rows.filter((r) => r.length);
  const failing = checked.filter((r) => r.length && !r.length.ok);

  return (
    <Panel
      data-testid="mdm-field-review"
      title="Field review"
      description="Every value, where it lands in SAP B1, and whether it fits the column."
      actions={
        <StatusText tone={failing.length ? "stuck" : "ok"} className="num">
          {failing.length
            ? `${failing.length} value${failing.length === 1 ? "" : "s"} too long for SAP B1`
            : `${checked.length} length checks passed`}
        </StatusText>
      }
      bodyClassName="p-0"
      footer={
        <span className="flex items-start gap-1.5">
          <Lock aria-hidden className="mt-0.5 size-3 shrink-0" />
          Credit terms and bank details are masked for everyone outside Finance and MDM, and every reveal is logged.
        </span>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Form field</TableHead>
            <TableHead>SAP property</TableHead>
            <TableHead>DB column</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="pr-4 text-right">Length (SDK 10.0)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key} data-system={r.system || undefined}>
              <TableCell className="py-2 pl-4 align-top whitespace-normal">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] font-medium text-foreground">
                  {r.label}
                  {ai.has(r.key) ? <AutoFilledTag /> : null}
                </span>
              </TableCell>
              <TableCell className="py-2 align-top">
                <code className="mono-id text-foreground">{r.sapProperty}</code>
              </TableCell>
              <TableCell className="py-2 align-top">
                <code className="mono-id text-muted-foreground">{r.dbColumn}</code>
                {!r.inImport && !r.isFile ? (
                  <span className="ml-1.5 text-xs text-muted-foreground">(not in this import)</span>
                ) : null}
              </TableCell>
              <TableCell className="max-w-[360px] py-2 align-top whitespace-normal">
                {r.sensitive ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MaskedValue value={r.value} requestId={req.id} fieldKey={r.key} />
                  </span>
                ) : r.isFile ? (
                  <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-foreground">
                    <Paperclip aria-hidden className="size-3.5 text-muted-foreground" />
                    {valueText(r.value)}
                  </span>
                ) : (
                  <span className="text-[0.8125rem] break-words text-foreground">
                    {r.system ? <code className="mono-id font-medium">{valueText(r.value)}</code> : valueText(r.value)}
                    {r.importValue ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        imports as <code className="mono-id text-secondary-foreground">{r.importValue}</code>
                      </span>
                    ) : null}
                  </span>
                )}
              </TableCell>
              <TableCell className="num py-2 pr-4 text-right align-top">
                {r.sensitive && !r.length ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock aria-hidden className="size-3" />
                    sensitive
                  </span>
                ) : r.length ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[0.8125rem] font-medium",
                      r.length.ok ? "text-ok-ink" : "text-stuck-ink",
                    )}
                  >
                    {r.length.ok ? <Check aria-label="Fits" className="size-3.5" /> : <X aria-label="Too long" className="size-3.5" />}
                    {r.length.length}/{r.length.exact ? `=${r.length.max}` : r.length.max}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">no SDK limit</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

"use client";

import { Check, Lock, Paperclip, Sparkles, X } from "lucide-react";
import type { MdmRequest } from "@/lib/types";
import { MaskedValue } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FieldReviewRow } from "./mdm-helpers";
import { Panel } from "./Panel";

function valueText(v: FieldReviewRow["value"]): string {
  if (v === null || v === undefined) return "—";
  return typeof v === "number" ? v.toLocaleString("en-SG") : String(v);
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
        <span
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium",
            failing.length ? "border-stuck/30 bg-stuck-soft text-stuck-ink" : "border-ok/30 bg-ok-soft text-ok-ink",
          )}
        >
          {failing.length ? <X aria-hidden className="size-3.5" /> : <Check aria-hidden className="size-3.5" />}
          {failing.length
            ? `${failing.length} value${failing.length === 1 ? "" : "s"} too long for SAP B1`
            : `${checked.length} length checks passed`}
        </span>
      }
      bodyClassName="px-0 py-0"
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5 text-muted-foreground">Form field</TableHead>
            <TableHead className="text-muted-foreground">SAP property</TableHead>
            <TableHead className="text-muted-foreground">DB column</TableHead>
            <TableHead className="text-muted-foreground">Value</TableHead>
            <TableHead className="pr-5 text-right text-muted-foreground">Length (SDK 10.0)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key} className={cn(r.system && "bg-primary-soft/40 hover:bg-primary-soft/60")}>
              <TableCell className="py-2 pl-5 align-top whitespace-normal">
                <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-foreground">
                  {r.label}
                  {ai.has(r.key) ? (
                    <span title="Filled by paste-to-fill, confirmed by the requestor" className="text-primary">
                      <Sparkles aria-label="Filled by paste-to-fill" className="size-3.5" />
                    </span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="py-2 align-top">
                <code className="font-mono text-[0.8125rem] text-foreground">{r.sapProperty}</code>
              </TableCell>
              <TableCell className="py-2 align-top">
                <code className="font-mono text-[0.8125rem] text-muted-foreground">{r.dbColumn}</code>
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
                    {r.system ? <code className="font-mono font-semibold">{valueText(r.value)}</code> : valueText(r.value)}
                    {r.importValue ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        imports as <code className="font-mono">{r.importValue}</code>
                      </span>
                    ) : null}
                  </span>
                )}
              </TableCell>
              <TableCell className="num py-2 pr-5 text-right align-top">
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
      <p className="flex items-center gap-1.5 border-t px-5 py-2.5 text-xs text-muted-foreground">
        <Lock aria-hidden className="size-3" />
        Credit terms and bank details are masked for everyone outside Finance and MDM, and every reveal is logged. Role-enforced in
        the prototype; production: restricted SharePoint list + Entra ID.
      </p>
    </Panel>
  );
}

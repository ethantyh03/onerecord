"use client";

import { Download, FileSpreadsheet, Lock } from "lucide-react";
import { toast } from "sonner";
import type { DtwFile } from "@/lib/types";
import { dtwToCsv } from "@/lib/engine/dtw";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DTW_HEADER_NOTE =
  "Row 1: DI/Service Layer property names · Row 2: database column names (per DTW template convention; confirm against the installed DTW Templates folder)";

function columnLetter(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function download(file: DtwFile, canDownload: boolean) {
  if (!canDownload) {
    toast.error("Only the MDM team can download SAP B1 import files", {
      description: "The files carry credit terms and bank details. Switch persona to Priya Nair (MDM).",
    });
    return;
  }
  const blob = new Blob([dtwToCsv(file)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  toast(`${file.fileName} downloaded`, { description: "Load it in the Data Transfer Workbench with its parent file." });
}

/** One DTW template file rendered as a spreadsheet: column letters, both header rows highlighted, then the data. */
function DtwGrid({
  file,
  sensitive,
  canSee,
  canDownload,
}: {
  file: DtwFile;
  sensitive: Set<string>;
  canSee: boolean;
  canDownload: boolean;
}) {
  const gutter = "sticky left-0 z-10 w-10 min-w-10 border-r bg-muted px-2 text-center text-[0.6875rem] font-medium text-muted-foreground";
  const cell = "border-r border-b px-2.5 py-1.5 whitespace-nowrap";
  const masked = (h: string) => !canSee && sensitive.has(h);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet aria-hidden className="size-4 text-ok-ink" />
          <code className="font-mono text-[0.8125rem] font-semibold text-foreground">{file.fileName}</code>
          <span className="text-xs text-muted-foreground">
            {file.headers.length} columns · {file.rows.length} data row{file.rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          data-testid={`mdm-download-${file.object}`}
          onClick={() => download(file, canDownload)}
        >
          <Download aria-hidden />
          Download CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 font-mono text-[0.75rem]">
          <thead>
            <tr>
              <th className={cn(gutter, "border-b")} aria-label="Row" />
              {file.headers.map((_, i) => (
                <th key={i} className={cn(cell, "bg-muted py-1 text-center text-[0.6875rem] font-medium text-muted-foreground")}>
                  {columnLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={cn(gutter, "border-b bg-primary-soft text-accent-foreground")} title="Row 1: DI/Service Layer property names">
                1
              </th>
              {file.headers.map((h, i) => (
                <td key={i} className={cn(cell, "bg-primary-soft font-semibold text-accent-foreground")}>
                  {h}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={cn(gutter, "border-b bg-warn-soft text-warn-ink")} title="Row 2: database column names">
                2
              </th>
              {file.dbHeaders.map((h, i) => (
                <td key={i} className={cn(cell, "bg-warn-soft text-warn-ink")}>
                  {h}
                </td>
              ))}
            </tr>
            {file.rows.map((row, r) => (
              <tr key={r}>
                <th scope="row" className={cn(gutter, "border-b")}>
                  {r + 3}
                </th>
                {row.map((c, i) => (
                  <td key={i} className={cn(cell, "bg-card text-foreground")}>
                    {masked(file.headers[i]) && c ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Lock aria-label="Masked" className="size-3" />
                        ••••••
                      </span>
                    ) : (
                      c || <span className="text-muted-foreground/60">·</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** (4) DTW import preview: one grid per file, with the two DTW header rows called out. */
export function DtwPreview({
  files,
  sensitive,
  canSee,
  canDownload,
}: {
  files: DtwFile[];
  sensitive: Set<string>;
  canSee: boolean;
  canDownload: boolean;
}) {
  return (
    <div data-testid="mdm-dtw-preview" className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-secondary-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm border border-primary/30 bg-primary-soft" />
          <strong className="font-semibold text-foreground">Row 1:</strong> DI/Service Layer property names
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm border border-warn/50 bg-warn-soft" />
          <strong className="font-semibold text-foreground">Row 2:</strong> database column names (per DTW template convention;
          confirm against the installed DTW Templates folder)
        </span>
      </div>
      {files.map((f) => (
        <DtwGrid key={f.fileName} file={f} sensitive={sensitive} canSee={canSee} canDownload={canDownload} />
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ArrowRight, Download, FileSpreadsheet, Lock } from "lucide-react";
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
  const gutter = "sticky left-0 z-10 w-10 min-w-10 border-r border-border-strong bg-secondary px-2 text-center text-xs font-normal text-subtle";
  const cell = "border-r border-b border-border px-2.5 py-1.5 whitespace-nowrap";
  const masked = (h: string) => !canSee && sensitive.has(h);
  // Wide templates (OITM has 20+ columns) scroll sideways: fade the right edge until the user reaches the end.
  const wide = file.headers.length > 6;
  const [atEnd, setAtEnd] = useState(false);

  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <FileSpreadsheet aria-hidden className="size-4 text-subtle" />
          <span className="text-sm">
            <code className="mono-id font-medium text-foreground">{file.fileName}</code>
          </span>
          <span className="num text-xs text-subtle">
            {file.headers.length} columns · {file.rows.length} data row{file.rows.length === 1 ? "" : "s"}
          </span>
          {wide ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              Scroll for all {file.headers.length} columns
              <ArrowRight aria-hidden className="size-3" />
            </span>
          ) : null}
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
      <div className="relative overflow-hidden rounded-sm border border-border-strong">
      <div
        className="overflow-x-auto"
        onScroll={
          wide
            ? (e) => {
                const el = e.currentTarget;
                setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
              }
            : undefined
        }
      >
        <table className="border-separate border-spacing-0 font-mono text-[0.75rem] [font-variant-ligatures:none]">
          <thead>
            <tr>
              <th className={cn(gutter, "border-b")} aria-label="Row" />
              {file.headers.map((_, i) => (
                <th key={i} className={cn(cell, "bg-secondary py-1 text-center text-xs font-normal text-subtle")}>
                  {columnLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* The two DTW header rows: a step lighter than the data, ruled off from it, numbered like the legend. */}
            <tr data-dtw-header="1">
              <th scope="row" className={cn(gutter, "border-b bg-foreground/[0.14] font-semibold text-foreground")} title="Row 1: DI/Service Layer property names">
                1
              </th>
              {file.headers.map((h, i) => (
                <td key={i} className={cn(cell, "bg-foreground/[0.09] font-semibold text-foreground")}>
                  {h}
                </td>
              ))}
            </tr>
            <tr data-dtw-header="2">
              <th scope="row" className={cn(gutter, "border-b-2 border-b-subtle bg-foreground/[0.14] font-semibold text-foreground")} title="Row 2: database column names">
                2
              </th>
              {file.dbHeaders.map((h, i) => (
                <td key={i} className={cn(cell, "border-b-2 border-b-subtle bg-foreground/[0.05] text-secondary-foreground italic")}>
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
      {wide ? (
        <div
          aria-hidden
          className={cn(
            // A scroll edge, not decoration: cut-off columns fade out until the user reaches the last one.
            "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent transition-opacity duration-300",
            atEnd ? "opacity-0" : "opacity-100",
          )}
        />
      ) : null}
      </div>
    </div>
  );
}

/** The legend's key for a header row: the same numbered gutter cell the grid uses, so it reads as a key, not a checkbox. */
function RowKey({ n }: { n: 1 | 2 }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 min-w-6 items-center justify-center rounded-[2px] bg-foreground/[0.14] px-1 font-mono text-xs font-semibold text-foreground"
    >
      {n}
    </span>
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
    <div data-testid="mdm-dtw-preview" className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-secondary-foreground">
        <span className="inline-flex items-center gap-1.5">
          <RowKey n={1} />
          <strong className="font-semibold text-foreground">Row 1:</strong> DI/Service Layer property names
        </span>
        <span className="inline-flex items-center gap-1.5">
          <RowKey n={2} />
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

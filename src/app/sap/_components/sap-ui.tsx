"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Classic B1 desktop-client stack: Tahoma at 11–12px. */
export const SAP_FONT = 'Tahoma, Verdana, "Segoe UI", Geneva, sans-serif';

/**
 * Window chrome for a B1 form: grey-blue title bar, menu strip, toolbar slot and status bar.
 * Generic styling only; no SAP marks.
 */
export function SapWindow({
  title,
  menu = ["Window", "Modules", "Data", "Goto", "Tools", "Help"],
  toolbar,
  status,
  children,
  className,
}: {
  title: ReactNode;
  menu?: string[];
  toolbar?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[6px] border border-[#5d7690] bg-[#eef2f6] text-[12px] text-[#1c2a39]",
        "shadow-[0_10px_30px_-12px_rgba(20,40,70,0.45),0_1px_0_rgba(255,255,255,0.6)_inset]",
        className,
      )}
      style={{ fontFamily: SAP_FONT }}
    >
      <div className="flex h-8 items-center gap-2 bg-gradient-to-b from-[#5a7a99] to-[#3c5a78] px-3 text-white">
        <span className="inline-flex size-4 items-center justify-center rounded-[3px] bg-gradient-to-b from-[#ffd75e] to-[#f0a800] text-[9px] font-bold text-[#3b2a00]">
          B1
        </span>
        <span className="truncate text-[12px] font-semibold tracking-[0.01em]">{title}</span>
        <span className="ml-auto flex items-center gap-1" aria-hidden="true">
          <span className="size-3 rounded-[2px] border border-white/40 bg-white/10" />
          <span className="size-3 rounded-[2px] border border-white/40 bg-white/10" />
          <span className="size-3 rounded-[2px] border border-white/40 bg-[#c4493a]/80" />
        </span>
      </div>
      <div className="flex h-6 items-center gap-4 border-b border-[#c3ced9] bg-[#e1e8ef] px-3 text-[11.5px] text-[#2c3e50]" aria-hidden="true">
        {menu.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      {toolbar ? (
        <div className="flex min-h-9 flex-wrap items-center gap-1.5 border-b border-[#c3ced9] bg-gradient-to-b from-[#f7f9fb] to-[#e6ecf2] px-2 py-1">
          {toolbar}
        </div>
      ) : null}
      <div className="bg-[#eef2f6]">{children}</div>
      {status ? (
        <div className="flex min-h-6 items-center gap-2 border-t border-[#c3ced9] bg-[#dfe6ee] px-3 py-0.5 text-[11px] text-[#2c3e50]">
          {status}
        </div>
      ) : null}
    </div>
  );
}

/** The B1 yellow-orange primary button (and its grey secondary). */
export function SapButton({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-[24px] min-w-[72px] items-center justify-center gap-1.5 rounded-[3px] border px-3.5 text-[12px] font-semibold whitespace-nowrap",
        "transition-[filter] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f6db5]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50",
        variant === "primary"
          ? "border-[#c38d00] bg-gradient-to-b from-[#ffe28a] to-[#f2b100] text-[#2b2000] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:brightness-105 active:brightness-95"
          : "border-[#97a6b6] bg-gradient-to-b from-[#ffffff] to-[#e1e7ed] text-[#1c2a39] hover:from-[#f7f9fb] hover:to-[#d9e1e9]",
        className,
      )}
      {...props}
    />
  );
}

/** Small toolbar icon button. */
export function SapToolButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-[3px] border border-transparent px-1.5 text-[11.5px] text-[#2c3e50]",
        "hover:border-[#a9b7c5] hover:bg-white/70 disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** The orange "link arrow" B1 shows beside fields that drill down to another object. */
export function LinkArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={cn("size-3 shrink-0", className)} aria-hidden="true">
      <path d="M2 1.5 L10.5 6 L2 10.5 Z" fill="#f0a800" stroke="#b57d00" strokeWidth="0.9" strokeLinejoin="round" />
    </svg>
  );
}

/** One label/value row of a B1 form. Values render in a sunken field box. */
export function SapField({
  label,
  children,
  linked,
  mono,
  wide,
  className,
}: {
  label: ReactNode;
  children?: ReactNode;
  linked?: boolean;
  mono?: boolean;
  wide?: boolean;
  className?: string;
}) {
  const empty = children === undefined || children === null || children === "";
  return (
    <div className={cn("grid grid-cols-[minmax(110px,40%)_1fr] items-center gap-2", wide && "sm:col-span-2", className)}>
      <span className="truncate text-[11.5px] text-[#2c3e50]">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        {linked && !empty ? <LinkArrow /> : <span className="w-3 shrink-0" />}
        <span
          className={cn(
            "flex min-h-[21px] min-w-0 flex-1 items-center truncate border border-[#a9b7c5] bg-white px-1.5 text-[11.5px] text-[#14202c] shadow-[inset_0_1px_1px_rgba(0,0,0,0.06)]",
            mono && "font-mono text-[11px]",
          )}
        >
          {empty ? <span className="text-[#9aa8b6]">&nbsp;</span> : children}
        </span>
      </span>
    </div>
  );
}

export function SapFieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-x-8 gap-y-1.5 sm:grid-cols-2", className)}>{children}</div>;
}

/** Folder-style tab strip used inside B1 forms. Controlled. */
export function SapTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("flex flex-wrap items-end gap-0.5 border-b border-[#8fa1b3] px-1", className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative -mb-px rounded-t-[4px] border px-3 text-[11.5px] whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2f6db5]",
              active
                ? "h-[25px] border-[#8fa1b3] border-b-[#f6f8fa] bg-[#f6f8fa] font-semibold text-[#14202c]"
                : "h-[22px] border-[#b7c3cf] bg-[#d9e1e9] text-[#33475b] hover:bg-[#e4eaf0]",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tab body panel matching SapTabs' active colour. */
export function SapTabPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" className={cn("border border-t-0 border-[#8fa1b3] bg-[#f6f8fa] p-3", className)}>
      {children}
    </div>
  );
}

/** B1 "matrix": grey header, row-number column, thin grid lines. */
export function SapMatrix({
  columns,
  subColumns,
  rows,
  renderCell,
  emptyText = "No rows",
  className,
  caption,
}: {
  columns: string[];
  /** Optional second header row (DTW DB column names). */
  subColumns?: string[];
  rows: string[][];
  renderCell?: (value: string, rowIndex: number, colIndex: number) => ReactNode;
  emptyText?: string;
  className?: string;
  caption?: string;
}) {
  return (
    <div className={cn("overflow-x-auto border border-[#8fa1b3] bg-white", className)}>
      <table className="w-max min-w-full border-collapse text-[11.5px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="bg-gradient-to-b from-[#e9eef3] to-[#d3dce5]">
            <th scope="col" className="w-8 border-r border-b border-[#b3c1ce] px-1.5 py-1 text-center font-semibold text-[#2c3e50]">
              #
            </th>
            {columns.map((c, i) => (
              <th key={`${c}-${i}`} scope="col" className="border-r border-b border-[#b3c1ce] px-2 py-1 text-left font-semibold whitespace-nowrap text-[#1c2a39]">
                {c}
              </th>
            ))}
          </tr>
          {subColumns ? (
            <tr className="bg-[#eef2f6]">
              <th scope="row" className="border-r border-b border-[#b3c1ce] px-1.5 py-0.5 text-center text-[10px] font-normal text-[#5b6f83]">
                DB
              </th>
              {subColumns.map((c, i) => (
                <th key={`${c}-${i}`} className="border-r border-b border-[#b3c1ce] px-2 py-0.5 text-left font-mono text-[10.5px] font-normal whitespace-nowrap text-[#5b6f83] italic">
                  {c}
                </th>
              ))}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="px-3 py-4 text-center text-[#6b7d8f]">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, r) => (
              <tr key={r} className={r % 2 ? "bg-[#f6f8fa]" : "bg-white"}>
                <td className="border-r border-b border-[#dde4eb] bg-[#eef2f6] px-1.5 py-1 text-center text-[#5b6f83] tabular-nums">{r + 1}</td>
                {columns.map((_, c) => (
                  <td key={c} className="border-r border-b border-[#dde4eb] px-2 py-1 whitespace-nowrap text-[#14202c]">
                    {renderCell ? renderCell(row[c] ?? "", r, c) : (row[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

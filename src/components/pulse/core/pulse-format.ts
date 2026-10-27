import { COUNTRIES, type CountryCode, type ProductGroup } from "@/lib/types";
import type { ViewKey } from "@/data/contract";
import type { PulseMeasure, PulseView } from "./PulseContext";

export const PULSE_COUNTRIES: CountryCode[] = ["SG", "MY", "TH", "VN", "MM"];
export const PULSE_PRODUCTS: ProductGroup[] = ["A", "B", "C"];

export const PRODUCT_SHORT: Record<ProductGroup, string> = {
  A: "IVD reagents & test kits",
  B: "Lab consumables",
  C: "Instruments",
};

export function countryName(code: CountryCode | string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/** Context view → data key. "merged" in the UI is the "dedup" (golden ID) view in the data. */
export function viewKey(view: PulseView): ViewKey {
  return view === "merged" ? "dedup" : "raw";
}

const MINUS = "−";

/** 0.0486 → "+4.9%", -0.35 → "−35.0%" (one decimal under 10%, whole above). null → fallback. */
export function formatPct(v: number | null | undefined, fallback = "n/a"): string {
  if (v == null || !Number.isFinite(v)) return fallback;
  const p = v * 100;
  const abs = Math.abs(p);
  const digits = abs >= 10 ? 0 : 1;
  const body = abs.toFixed(digits);
  if (Number(body) === 0) return "0%";
  return `${p > 0 ? "+" : MINUS}${body}%`;
}

/** Compact S$: 10370504 → "S$10.4M", 648000 → "S$648k". */
export function sgdCompact(v: number): string {
  if (!Number.isFinite(v)) return "S$0";
  const sign = v < 0 ? MINUS : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}S$${trim((a / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2))}M`;
  if (a >= 10_000) return `${sign}S$${Math.round(a / 1_000)}k`;
  if (a >= 1_000) return `${sign}S$${trim((a / 1_000).toFixed(1))}k`;
  return `${sign}S$${Math.round(a).toLocaleString("en-SG")}`;
}

/** Signed compact S$ for deltas: "+S$477k", "−S$724k". */
export function sgdDelta(v: number): string {
  if (!v) return "S$0";
  return `${v > 0 ? "+" : MINUS}${sgdCompact(Math.abs(v))}`;
}

/** 56057 → "56.1k", 812 → "812" */
export function countCompact(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${trim((v / 1_000_000).toFixed(1))}M`;
  if (a >= 10_000) return `${trim((v / 1_000).toFixed(1))}k`;
  return Math.round(v).toLocaleString("en-SG");
}

export function measureValue(measure: PulseMeasure, sgd: number, units: number | undefined): string {
  if (measure === "units") return units == null ? "n/a" : `${countCompact(units)} units`;
  return sgdCompact(sgd);
}

/** "2026-11-15" → "15 Nov 2026" */
export function formatIsoDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "2025-10" → "Oct 2025" */
export function formatMonth(m: string): string {
  const d = new Date(`${m}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return m;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function trim(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/**
 * Diverging fill for YoY growth: cool (chart-1) for growth, warm (chart-2) for decline, card surface at ±1%.
 * Built with color-mix on theme variables so it follows light and dark mode.
 */
export const YOY_BINS: { min: number; max: number; label: string; pct: number; pole: "pos" | "neg" | "mid" }[] = [
  { min: -Infinity, max: -0.2, label: "≤ −20%", pct: 52, pole: "neg" },
  { min: -0.2, max: -0.1, label: "−10 to −20%", pct: 38, pole: "neg" },
  { min: -0.1, max: -0.03, label: "−3 to −10%", pct: 24, pole: "neg" },
  { min: -0.03, max: 0.03, label: "within ±3%", pct: 0, pole: "mid" },
  { min: 0.03, max: 0.1, label: "+3 to +10%", pct: 24, pole: "pos" },
  { min: 0.1, max: 0.2, label: "+10 to +20%", pct: 38, pole: "pos" },
  { min: 0.2, max: Infinity, label: "≥ +20%", pct: 52, pole: "pos" },
];

export function binFill(bin: (typeof YOY_BINS)[number]): string {
  if (bin.pole === "mid") return "color-mix(in oklch, var(--muted) 70%, var(--card))";
  const hue = bin.pole === "pos" ? "var(--chart-1)" : "var(--chart-2)";
  return `color-mix(in oklch, ${hue} ${bin.pct}%, var(--card))`;
}

export function yoyFill(yoy: number | null | undefined): string {
  if (yoy == null || !Number.isFinite(yoy)) return "var(--card)";
  const bin = YOY_BINS.find((b) => yoy >= b.min && yoy < b.max) ?? YOY_BINS[3];
  return binFill(bin);
}

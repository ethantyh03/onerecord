"use client";

/**
 * Shared view state for the Regional Pulse page.
 * Contract between pulse-core (owns the page) and pulse-analytics (owns analytics panels).
 * Do not change the shape without the lead.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CountryCode, ProductGroup } from "@/lib/types";

export type PulseView = "merged" | "raw"; // merged = golden IDs (default)
export type PulseMeasure = "sgd" | "units";

export interface PulseState {
  view: PulseView;
  setView: (v: PulseView) => void;
  measure: PulseMeasure;
  setMeasure: (m: PulseMeasure) => void;
  /** Selected cell for the forecast panel / drill-downs */
  country: CountryCode;
  setCountry: (c: CountryCode) => void;
  product: ProductGroup;
  setProduct: (p: ProductGroup) => void;
}

const PulseCtx = createContext<PulseState | null>(null);

export function PulseProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<PulseView>("merged");
  const [measure, setMeasure] = useState<PulseMeasure>("sgd");
  const [country, setCountry] = useState<CountryCode>("SG");
  const [product, setProduct] = useState<ProductGroup>("A");
  const value = useMemo(
    () => ({ view, setView, measure, setMeasure, country, setCountry, product, setProduct }),
    [view, measure, country, product],
  );
  return <PulseCtx.Provider value={value}>{children}</PulseCtx.Provider>;
}

export function usePulse(): PulseState {
  const ctx = useContext(PulseCtx);
  if (!ctx) throw new Error("usePulse must be used inside <PulseProvider>");
  return ctx;
}

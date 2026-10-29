"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { geoGraticule, geoMercator, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Combine, SplitSquareVertical } from "lucide-react";
import { bridge, matrix } from "@/data/contract";
import type { CountryCode } from "@/lib/types";
import { useStuckDemand } from "@/lib/selectors";
import { StateGlyph } from "@/components/common/glyph";
import { formatSgd } from "@/components/common/format";
import { cn } from "@/lib/utils";
import { usePulse } from "./PulseContext";
import { PULSE_COUNTRIES, countryName, formatPct, sgdCompact, sgdDelta } from "./pulse-format";

/**
 * Signature moment 2: the region map, the Regional Pulse lead visual.
 *
 * Every number on it is already on the page: country totals and growth from the matrix (raw or merged), the
 * Δ that cleaning moves between countries (the matrix's country-total badges), live stuck demand per country
 * (the streams panel) and the Malaysian duplicate hospital (the top-accounts panel).
 * Land is grey; the only colour is data: the signal arcs carry the orders that merging moves from Singapore
 * records back to Malaysian and Vietnamese hospitals, coral is money waiting, amber/coral the duplicate hospital.
 * The Merged / Raw toggle drives one progress value p (0 = raw SAP records, 1 = merged customers): the arcs draw
 * out of Singapore, the totals count across, and the three Bukit Damai records collapse into one.
 * Static under reduced motion.
 */

export type MapFocus = "hero" | "flows" | "stuck";

/** ISO 3166-1 numeric ids in world-atlas. */
const ISO: Record<CountryCode, string> = { SG: "702", MY: "458", TH: "764", VN: "704", MM: "104" };
/** Neighbours drawn as quiet context land. */
const CONTEXT_IDS = new Set(["156", "356", "050", "418", "116", "360", "096", "608", "064", "524", "158", "144"]);
/** Neighbour names, so the gaps between our five read as "not ours" rather than missing data. */
const CONTEXT_LABELS: { name: string; at: [number, number] }[] = [
  { name: "Laos", at: [102.1, 20.2] },
  { name: "China", at: [104.5, 25.6] },
  { name: "India", at: [91.9, 25.9] },
  { name: "Indonesia", at: [113.6, -0.9] },
];

/** Where each entity sits: Singapore (hub, MDM team), Kuala Lumpur, Bangkok, Ho Chi Minh City, Yangon. */
const NODES: Record<CountryCode, [number, number]> = {
  SG: [103.8198, 1.3521],
  MY: [101.6869, 3.139],
  TH: [100.5018, 13.7563],
  VN: [106.6297, 10.8231],
  MM: [96.1561, 16.8409],
};

/** Readouts sit in two columns beside the map, in geographic order, so they never cover a country. */
const LEFT: CountryCode[] = ["MM", "TH", "MY"];
const RIGHT: CountryCode[] = ["VN", "SG"];
/** Nudges from the node's height, so readouts sit over open sea rather than in a stack. */
const WANT_DY: Record<CountryCode, number> = { MM: -30, TH: 34, MY: 0, VN: -40, SG: 6 };
/** Countries that gain the value booked on Singapore records once customers are merged. */
const FLOW_TARGETS: CountryCode[] = ["MY", "VN"];

interface GeoData {
  ours: FeatureCollection;
  byCode: Record<CountryCode, Feature<Geometry>>;
  context: Feature<Geometry>[];
}

let geoPromise: Promise<GeoData> | null = null;

/** Loads countries-50m once (Singapore only exists at this resolution) and keeps the region and its neighbours. */
function loadGeo(): Promise<GeoData> {
  geoPromise ??= import("world-atlas/countries-50m.json").then((mod) => {
    const topo = ((mod as { default?: unknown }).default ?? mod) as unknown as Topology<{ countries: GeometryCollection }>;
    const all = feature(topo, topo.objects.countries) as FeatureCollection<Geometry>;
    const byCode = {} as Record<CountryCode, Feature<Geometry>>;
    const context: Feature<Geometry>[] = [];
    for (const f of all.features) {
      const id = String(f.id ?? "");
      const code = (Object.keys(ISO) as CountryCode[]).find((c) => ISO[c] === id);
      if (code) byCode[code] = f;
      else if (CONTEXT_IDS.has(id)) context.push(f);
    }
    return { ours: { type: "FeatureCollection", features: PULSE_COUNTRIES.map((c) => byCode[c]) }, byCode, context };
  });
  return geoPromise;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * 0 = raw SAP records, 1 = merged customers. Animates between the two when the presenter flips the toggle;
 * jumps when the change happens before first paint (the /demo scene opens on ?view=raw) or motion is reduced.
 */
function useViewProgress(target: 0 | 1): number {
  const [p, setP] = useState<number>(target);
  const current = useRef<number>(target);
  const painted = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      painted.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduce = false;
    }
    if (!painted.current || reduce) {
      current.current = target;
      setP(target);
      return;
    }
    const from = current.current;
    const dur = target === 1 ? 1400 : 650;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = clamp01((t - start) / dur);
      const v = from + (target - from) * ease(k);
      current.current = v;
      setP(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return p;
}

/** Element size, observed. */
function useSize<T extends HTMLElement>(): [RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

interface Placed {
  code: CountryCode;
  top: number;
  h: number;
}

/** Stacks readouts near their wanted height without overlap, inside [min, max]. */
function relax(items: { code: CountryCode; want: number; h: number }[], min: number, max: number, gap: number): Placed[] {
  const s = [...items].sort((a, b) => a.want - b.want).map((i) => ({ code: i.code, h: i.h, top: i.want - i.h / 2 }));
  const forward = () => {
    for (let i = 0; i < s.length; i++) {
      if (i === 0) s[i].top = Math.max(min, s[i].top);
      else s[i].top = Math.max(s[i].top, s[i - 1].top + s[i - 1].h + gap);
    }
  };
  forward();
  for (let i = s.length - 1; i >= 0; i--) {
    const limit = i === s.length - 1 ? max - s[i].h : s[i + 1].top - gap - s[i].h;
    s[i].top = Math.min(s[i].top, limit);
  }
  forward();
  return s;
}

/** Quadratic arc from a to b, bowed towards `side` (−1 west, +1 east), with an arrowhead short of b. */
function arcGeometry(a: [number, number], b: [number, number], side: number, bow: number) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let nx = -dy;
  let ny = dx;
  if (Math.sign(nx) !== Math.sign(side) && nx !== 0) {
    nx = -nx;
    ny = -ny;
  }
  const len = Math.hypot(nx, ny) || 1;
  const dist = Math.hypot(dx, dy);
  const c: [number, number] = [mx + (nx / len) * dist * bow, my + (ny / len) * dist * bow];
  const at = (t: number): [number, number] => [
    (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
    (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
  ];
  const d = `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  const tx = b[0] - c[0];
  const ty = b[1] - c[1];
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const tip: [number, number] = [b[0] - ux * 6, b[1] - uy * 6];
  const base: [number, number] = [tip[0] - ux * 9, tip[1] - uy * 9];
  const arrow = [tip, [base[0] - uy * 4.5, base[1] + ux * 4.5], [base[0] + uy * 4.5, base[1] - ux * 4.5]]
    .map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`)
    .join(" ");
  return { d, at, arrow };
}

type CountryNumbers = Record<CountryCode, { raw: number; merged: number; yoyRaw: number | null; yoyMerged: number | null; delta: number }>;

const COUNTRY_NUMBERS: CountryNumbers = (() => {
  const out = {} as CountryNumbers;
  for (const c of PULSE_COUNTRIES) {
    const d = matrix.views.dedup.countryTotals.find((t) => t.key === c);
    const r = matrix.views.raw.countryTotals.find((t) => t.key === c);
    out[c] = {
      raw: r?.sgd12m ?? 0,
      merged: d?.sgd12m ?? 0,
      yoyRaw: r?.yoy ?? null,
      yoyMerged: d?.yoy ?? null,
      delta: Math.round((d?.sgd12m ?? 0) - (r?.sgd12m ?? 0)),
    };
  }
  return out;
})();

function lerpYoy(a: number | null, b: number | null, p: number): number | null {
  if (a == null || b == null) return p < 0.5 ? a : b;
  return lerp(a, b, p);
}

function Trend({ v }: { v: number | null }) {
  const cls = "size-3.5 shrink-0 text-muted-foreground";
  if (v == null || Math.abs(v) < 0.03) return <ArrowRight aria-hidden className={cls} />;
  return v > 0 ? <ArrowUpRight aria-hidden className={cls} /> : <ArrowDownRight aria-hidden className={cls} />;
}

/**
 * Readout for one country, set like a meta column: a thin rule facing the map, name, 12-month orders, growth,
 * the cleaning Δ, live stuck demand, and (Malaysia) the duplicate hospital. Left-column readouts mirror.
 */
function CountryReadout({
  code,
  p,
  side,
  selected,
  hovered,
  dim,
  stuckFocus,
  onSelect,
  onHover,
  width,
  style,
  innerRef,
}: {
  code: CountryCode;
  p: number;
  side: "left" | "right" | "list";
  selected: boolean;
  hovered: boolean;
  dim: boolean;
  stuckFocus: boolean;
  onSelect: () => void;
  onHover: (h: boolean) => void;
  width?: number;
  style?: CSSProperties;
  innerRef?: (el: HTMLButtonElement | null) => void;
}) {
  const nums = COUNTRY_NUMBERS[code];
  const stuck = useStuckDemand().byCountry[code] ?? { sgd: 0, count: 0, maxDaysWaiting: 0 };
  const value = lerp(nums.raw, nums.merged, p);
  const yoy = lerpYoy(nums.yoyRaw, nums.yoyMerged, p);
  const deltaOpacity = clamp01((p - 0.55) / 0.35);
  const hero = code === "MY" ? bridge.countries.find((c) => c.country === "MY")?.topAccounts.dedup.find((a) => a.hero) : undefined;
  const heroShort = hero?.name.split(" ").slice(0, 2).join(" ");
  const merged = p >= 0.5;
  const mirror = side === "left";
  const row = cn("flex items-baseline gap-2", mirror && "flex-row-reverse");

  return (
    <button
      ref={innerRef}
      type="button"
      data-testid={`pulse-map-country-${code}`}
      aria-pressed={selected}
      aria-label={`${countryName(code)}: ${sgdCompact(merged ? nums.merged : nums.raw)} customer orders in the last 12 months, ${formatPct(merged ? nums.yoyMerged : nums.yoyRaw)} year on year. Select to show its forecast.`}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      style={{ width, ...style }}
      className={cn(
        // A meta column: one 1px rule facing the map (the leader line starts on it), no fill, no rail.
        "group/label block py-0.5 transition-[opacity,border-color,top] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        side !== "list" && "absolute",
        mirror ? "border-r pr-3 pl-2 text-right" : "border-l pl-3 pr-2 text-left",
        selected ? "border-foreground" : hovered ? "border-muted-foreground" : "border-border-strong",
        dim && "opacity-30",
      )}
    >
      <span className={row}>
        <span
          className={cn(
            "text-sm font-semibold transition-colors",
            selected || hovered ? "text-foreground" : "text-secondary-foreground",
          )}
        >
          {countryName(code)}
        </span>
        <span className="text-xs text-subtle">{code}</span>
      </span>
      <span className={cn(row, "mt-0.5")}>
        <span className="num font-wide text-[1.25rem] leading-6 font-semibold text-foreground">{sgdCompact(value)}</span>
        <span className="num inline-flex items-center gap-0.5 text-[0.8125rem] font-medium text-secondary-foreground">
          <Trend v={yoy} />
          {formatPct(yoy)}
        </span>
      </span>
      {nums.delta !== 0 ? (
        <span
          className={cn("flex overflow-hidden", mirror && "justify-end")}
          style={{ opacity: deltaOpacity, height: 18 * clamp01((p - 0.35) / 0.4), marginTop: 2 * clamp01((p - 0.35) / 0.4) }}
          aria-hidden={deltaOpacity < 0.5}
          title={`Cleaning moved ${sgdDelta(nums.delta)} ${nums.delta > 0 ? "into" : "out of"} ${countryName(code)}`}
        >
          {/* Bare figure, no chip: the teal Δ ties it to the teal arcs (orders moved by merging). */}
          <span className="num inline-flex items-baseline gap-1 text-xs leading-[18px] font-semibold whitespace-nowrap text-foreground">
            <span aria-hidden className="text-signal">
              Δ
            </span>
            {sgdDelta(nums.delta)}
          </span>
        </span>
      ) : null}
      {stuck.count > 0 ? (
        <span
          className={cn(
            "mt-1 flex items-center gap-1.5 text-xs text-stuck-ink transition-colors",
            mirror && "flex-row-reverse",
            stuckFocus && "text-stuck underline decoration-stuck/60 underline-offset-[3px]",
          )}
        >
          <StateGlyph tone="stuck" size={stuckFocus ? "md" : "sm"} />
          <span>
            <span className="num font-semibold">{formatSgd(stuck.sgd)}</span> stuck
          </span>
        </span>
      ) : null}
      {hero && heroShort ? (
        <span className={cn("mt-1.5 flex items-center gap-1.5 text-xs whitespace-nowrap", mirror && "flex-row-reverse")}>
          <span aria-hidden className="relative inline-block h-2 w-7 shrink-0">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute top-0 size-2 rounded-full"
                style={{
                  ...(mirror ? { right: `${(1 - p) * i * 10}px` } : { left: `${(1 - p) * i * 10}px` }),
                  opacity: i === 0 ? 1 : 1 - p,
                  background: merged ? "var(--stuck)" : "var(--warn)",
                }}
              />
            ))}
          </span>
          {merged ? (
            <span className="text-stuck-ink" title={`${hero.name}: ${formatPct(hero.yoy)} year on year`}>
              {heroShort} <span className="num font-semibold">{formatPct(hero.yoy)}</span>
            </span>
          ) : (
            <span className="text-warn-ink">
              {heroShort}: <span className="num font-semibold">3</span> records
            </span>
          )}
        </span>
      ) : null}
    </button>
  );
}

/** The map: five countries in grey, entity nodes, rule-set readouts with leader lines, and the re-attribution arcs. */
export function RegionMap({ focus = null }: { focus?: MapFocus | null }) {
  const { view, country, setCountry } = usePulse();
  const p = useViewProgress(view === "merged" ? 1 : 0);
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [wellRef, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<CountryCode | null>(null);
  const labelEls = useRef<Partial<Record<CountryCode, HTMLButtonElement | null>>>({});
  const [labelH, setLabelH] = useState<Record<CountryCode, number>>({ SG: 92, MY: 112, TH: 70, VN: 92, MM: 70 });

  useEffect(() => {
    let live = true;
    loadGeo()
      .then((g) => {
        if (live) setGeo(g);
      })
      .catch(() => {
        /* the readouts still render in the list below */
      });
    return () => {
      live = false;
    };
  }, []);

  const compact = w > 0 && w < 600;
  const colW = Math.round(Math.min(204, Math.max(172, w * 0.215)));

  const layout = useMemo(() => {
    if (!geo || w === 0 || h === 0) return null;
    const padY = 22;
    const side = compact ? 12 : colW + 40;
    const proj: GeoProjection = geoMercator().fitExtent(
      [
        [side, padY],
        [w - side, h - padY],
      ],
      geo.ours,
    );
    proj.clipExtent([
      [0, 0],
      [w, h],
    ]);
    const path = geoPath(proj);
    const [[x0], [x1]] = path.bounds(geo.ours);
    const shapes = {} as Record<CountryCode, string>;
    for (const c of PULSE_COUNTRIES) shapes[c] = path(geo.byCode[c]) ?? "";
    const context = geo.context.map((f) => path(f) ?? "").filter(Boolean);
    const graticule =
      path(
        geoGraticule()
          .step([5, 5])
          .extent([
            [60, -25],
            [150, 50],
          ])(),
      ) ?? "";
    const nodes = {} as Record<CountryCode, [number, number]>;
    for (const c of PULSE_COUNTRIES) nodes[c] = (proj(NODES[c]) ?? [0, 0]) as [number, number];
    const names = CONTEXT_LABELS.map((l) => ({ name: l.name, xy: proj(l.at) as [number, number] | null })).filter(
      (l): l is { name: string; xy: [number, number] } => l.xy != null && l.xy[1] > 14 && l.xy[1] < h - 10,
    );
    return { shapes, context, graticule, nodes, names, mapLeft: x0, mapRight: x1 };
  }, [geo, w, h, compact, colW]);

  // Measure the readouts (their height depends on what each country shows).
  useLayoutEffect(() => {
    if (compact) return;
    let next: Record<CountryCode, number> | null = null;
    for (const c of PULSE_COUNTRIES) {
      const el = labelEls.current[c];
      if (el && Math.abs(el.offsetHeight - labelH[c]) > 0.5) {
        next = next ?? { ...labelH };
        next[c] = el.offsetHeight;
      }
    }
    if (next) setLabelH(next);
  });

  const placed = useMemo(() => {
    if (!layout || compact) return null;
    const leftX = Math.max(8, Math.min(layout.mapLeft - 34 - colW, w / 2 - colW - 40));
    const rightX = Math.min(w - 8 - colW, Math.max(layout.mapRight + 34, w / 2 + 40));
    const col = (codes: CountryCode[], x: number, isLeft: boolean) =>
      relax(
        codes.map((c) => ({ code: c, want: layout.nodes[c][1] + WANT_DY[c], h: labelH[c] })),
        14,
        h - 14,
        14,
      ).map((pl) => ({ ...pl, x, isLeft }));
    return [...col(LEFT, leftX, true), ...col(RIGHT, rightX, false)];
  }, [layout, compact, colW, w, h, labelH]);

  const dimFor = (c: CountryCode) =>
    focus === "hero" ? c !== "MY" : focus === "flows" ? !(c === "SG" || FLOW_TARGETS.includes(c)) : false;

  const draw = clamp01((p - 0.05) / 0.7);
  const arrowOpacity = clamp01((draw - 0.85) / 0.15);
  const arcs =
    layout && draw > 0
      ? FLOW_TARGETS.map((t) => {
          const a = layout.nodes.SG;
          const b = layout.nodes[t];
          const side = b[0] < a[0] ? -1 : 1;
          return { t, ...arcGeometry(a, b, side, t === "MY" ? 0.38 : 0.3) };
        })
      : [];

  const merged = view === "merged";
  const sgOut = sgdCompact(Math.abs(COUNTRY_NUMBERS.SG.delta));

  return (
    <section
      aria-labelledby="pulse-map-title"
      data-testid="pulse-map"
      data-view={view}
      className="panel flex min-w-0 flex-col self-start overflow-hidden"
    >
      <header className="panel-header flex-wrap">
        <h2 id="pulse-map-title" className="panel-title">
          Customer orders by country, last 12 months
        </h2>
        <span className="text-xs text-subtle">Click a country to show its forecast</span>
      </header>

      <div
        ref={wellRef}
        className="relative h-[clamp(21rem,calc(100vh-29rem),30rem)] min-h-[21rem] bg-canvas"
        onMouseLeave={() => setHover(null)}
      >
        {layout ? (
          <svg
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            className="absolute inset-0 block"
            role="img"
            aria-label={`Map of Singapore, Malaysia, Thailand, Vietnam and Myanmar showing ${merged ? "merged customers" : "raw SAP records"}.`}
          >
            <path d={layout.graticule} fill="none" style={{ stroke: "var(--border)" }} strokeWidth={0.75} strokeOpacity={0.8} />
            {layout.context.map((d, i) => (
              <path
                key={i}
                d={d}
                style={{ fill: "color-mix(in oklab, var(--card) 80%, var(--canvas))", stroke: "var(--border-strong)", strokeOpacity: 0.6 }}
                strokeWidth={0.7}
              />
            ))}
            {layout.names.map((n) => (
              <text
                key={n.name}
                x={n.xy[0]}
                y={n.xy[1]}
                textAnchor="middle"
                className="pointer-events-none select-none"
                style={{ fill: "var(--subtle)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}
              >
                {n.name}
              </text>
            ))}
            {PULSE_COUNTRIES.map((c) => {
              const sel = c === country;
              const hov = c === hover;
              return (
                <path
                  key={c}
                  d={layout.shapes[c]}
                  data-country={c}
                  onClick={() => setCountry(c)}
                  onMouseEnter={() => setHover(c)}
                  className="cursor-pointer"
                  style={{
                    fill: `color-mix(in oklab, var(--muted-foreground) ${hov || sel ? 30 : 20}%, var(--card))`,
                    stroke: sel ? "var(--foreground)" : hov ? "var(--muted-foreground)" : "var(--subtle)",
                    strokeOpacity: sel || hov ? 1 : 0.75,
                    strokeWidth: sel ? 1.5 : 0.9,
                    opacity: dimFor(c) ? 0.5 : 1,
                    transition: "fill 200ms ease, stroke 200ms ease, opacity 300ms ease",
                  }}
                >
                  <title>{countryName(c)}</title>
                </path>
              );
            })}

            {/* Leader lines from each readout's rule to its entity node */}
            {placed?.map((pl) => {
              const n = layout.nodes[pl.code];
              const y = pl.top + 14;
              const x = pl.isLeft ? pl.x + colW : pl.x;
              const elbow = pl.isLeft ? x + 14 : x - 14;
              const active = pl.code === hover || pl.code === country;
              return (
                <polyline
                  key={`lead-${pl.code}`}
                  points={`${x},${y} ${elbow},${y} ${n[0]},${n[1]}`}
                  fill="none"
                  style={{ stroke: active ? "var(--muted-foreground)" : "var(--border-strong)", opacity: dimFor(pl.code) ? 0.3 : 1, transition: "opacity 300ms ease" }}
                  strokeWidth={1}
                />
              );
            })}

            {/* Orders booked on Singapore records travel back to the hospitals' own countries when merged */}
            {arcs.map((a) => {
              const head = a.at(draw);
              return (
                <g key={`arc-${a.t}`} style={{ opacity: focus === "hero" || focus === "stuck" ? 0.3 : 1, transition: "opacity 300ms ease" }}>
                  <path
                    d={a.d}
                    pathLength={1}
                    fill="none"
                    style={{ stroke: "var(--signal)" }}
                    strokeWidth={focus === "flows" ? 2.5 : 1.75}
                    strokeLinecap="round"
                    strokeDasharray="1 1"
                    strokeDashoffset={1 - draw}
                  />
                  {draw < 1 ? <circle cx={head[0]} cy={head[1]} r={3.5} style={{ fill: "var(--signal)" }} /> : null}
                  <polygon points={a.arrow} style={{ fill: "var(--signal)", opacity: arrowOpacity }} />
                </g>
              );
            })}

            {/* Entity nodes: Singapore is the hub (MDM team) */}
            {PULSE_COUNTRIES.map((c) => {
              const [x, y] = layout.nodes[c];
              const hub = c === "SG";
              return (
                <g key={`node-${c}`} style={{ opacity: dimFor(c) ? 0.4 : 1, transition: "opacity 300ms ease" }}>
                  {hub ? <circle cx={x} cy={y} r={8.5} fill="none" style={{ stroke: "var(--foreground)" }} strokeOpacity={0.6} strokeWidth={1} /> : null}
                  <circle cx={x} cy={y} r={hub ? 4 : 3.25} style={{ fill: "var(--foreground)", stroke: "var(--canvas)" }} strokeWidth={1.5} />
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-subtle">Loading map…</div>
        )}

        {/* Layer readout: which customer view the map is drawing */}
        <div className="pointer-events-none absolute top-3 right-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {merged ? <Combine aria-hidden className="size-3.5 text-subtle" /> : <SplitSquareVertical aria-hidden className="size-3.5 text-subtle" />}
          {merged ? "Merged customers" : "Raw SAP records"}
        </div>

        {placed && layout
          ? placed.map((pl) => (
              <CountryReadout
                key={pl.code}
                code={pl.code}
                p={p}
                side={pl.isLeft ? "left" : "right"}
                width={colW}
                style={{ left: pl.x, top: pl.top }}
                innerRef={(el) => {
                  labelEls.current[pl.code] = el;
                }}
                selected={pl.code === country}
                hovered={pl.code === hover}
                dim={dimFor(pl.code)}
                stuckFocus={focus === "stuck"}
                onSelect={() => setCountry(pl.code)}
                onHover={(on) => setHover(on ? pl.code : null)}
              />
            ))
          : null}
      </div>

      {compact || (!layout && w > 0) ? (
        <div className="grid gap-x-4 gap-y-3 border-t border-border p-4 sm:grid-cols-2">
          {PULSE_COUNTRIES.map((c) => (
            <CountryReadout
              key={c}
              code={c}
              p={p}
              side="list"
              selected={c === country}
              hovered={c === hover}
              dim={dimFor(c)}
              stuckFocus={focus === "stuck"}
              onSelect={() => setCountry(c)}
              onHover={(on) => setHover(on ? c : null)}
            />
          ))}
        </div>
      ) : null}

      <footer className="flex flex-col gap-2 border-t border-border px-4 py-2.5 md:flex-row md:items-center md:justify-between md:gap-6">
        <p className="text-[0.8125rem] text-secondary-foreground" aria-live="polite">
          {merged ? (
            <>
              Merged: <span className="num font-semibold text-foreground">{sgOut}</span> of orders on Singapore records move back to
              the Malaysian and Vietnamese hospitals that placed them.
            </>
          ) : (
            "Raw SAP records: every record counted where it was booked."
          )}
        </p>
        <ul className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Map key">
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="relative inline-flex size-3 items-center justify-center rounded-full border border-foreground/60">
              <span className="size-1.5 rounded-full bg-foreground" />
            </span>
            MDM team, Singapore
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
            Lives entity
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 bg-signal" />
            Orders moved by merging
          </li>
        </ul>
      </footer>
    </section>
  );
}

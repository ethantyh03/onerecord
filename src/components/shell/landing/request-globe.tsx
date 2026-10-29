"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useReducedMotion } from "motion/react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { master } from "@/data/contract";
import { useSandbox } from "@/lib/store";
import type { CountryCode } from "@/lib/types";
import { useTheme } from "@/components/common/use-theme";
import { cn } from "@/lib/utils";
import {
  GLOBE_NODES,
  HUB,
  MERGE_GLIDE_MS,
  MERGE_TOTAL_MS,
  OPERATING_ISO_IDS,
  REGION_LON,
  buildArcs,
  buildCustomerPoints,
  buildDotMatrix,
  countByCountry,
  fitCamera,
  hashUnit,
  makeCamera,
  mergeOffsetMs,
  mergeProgress,
  openRequestsForGlobe,
  slerp,
  toVec,
  type ArcPath,
  type Camera,
  type CameraParams,
  type CustomerPoint,
  type GlobeRequest,
  type Vec3,
} from "./globe-data";
import type { MergeClock } from "./merge-clock";

/** Open requests in this browser's sandbox, live from the store. Shared by the globe, its legend and the panel. */
export function useGlobeRequests(): GlobeRequest[] {
  const requests = useSandbox((s) => s.requests);
  return useMemo(() => openRequestsForGlobe(requests), [requests]);
}

// ---------- Geography: built once per page load from world-atlas (bundled, works offline) ----------

const RAD = Math.PI / 180;
/** Coastline vertices closer than this (degrees) are dropped: well under a pixel at the hero's scale. */
const SIMPLIFY_DEG = 0.04;
/** Land texture: a fine dot matrix attached to the sphere, so it foreshortens towards the horizon. */
const TEXTURE_SPACING_DEG = 0.21;

/** Lines on the sphere: unit vectors, `starts[i]..starts[i + 1]` is line i. */
interface Lines {
  xyz: Float32Array;
  starts: Uint32Array;
}

interface Geo {
  /** World land (110m: the hero never needs more detail outside the five countries) */
  land: Lines;
  /** The five operating countries at 50m (Singapore only exists from 50m) */
  lives: Lines;
  /** Borders between countries (110m) */
  borders: Lines;
  texture: { xyz: Float32Array; kind: Uint8Array };
  points: CustomerPoint[];
}

function simplify(coords: number[][]): number[][] {
  if (coords.length < 4) return coords;
  const out = [coords[0]];
  let [plon, plat] = coords[0];
  for (let i = 1; i < coords.length - 1; i++) {
    const [lon, lat] = coords[i];
    if (Math.abs(lon - plon) * Math.cos(lat * RAD) + Math.abs(lat - plat) >= SIMPLIFY_DEG) {
      out.push(coords[i]);
      plon = lon;
      plat = lat;
    }
  }
  out.push(coords[coords.length - 1]);
  return out;
}

function toLines(geoms: Geometry[]): Lines {
  const parts: number[][][] = [];
  const add = (g: Geometry) => {
    if (g.type === "Polygon") parts.push(...g.coordinates);
    else if (g.type === "MultiPolygon") for (const p of g.coordinates) parts.push(...p);
    else if (g.type === "LineString") parts.push(g.coordinates);
    else if (g.type === "MultiLineString") parts.push(...g.coordinates);
    else if (g.type === "GeometryCollection") g.geometries.forEach(add);
  };
  geoms.forEach(add);
  const xyz: number[] = [];
  const starts: number[] = [0];
  for (const part of parts) {
    const s = simplify(part);
    if (s.length < 2) continue;
    for (const [lon, lat] of s) xyz.push(...toVec([lon, lat]));
    starts.push(xyz.length / 3);
  }
  return { xyz: Float32Array.from(xyz), starts: Uint32Array.from(starts) };
}

function geometries(fc: FeatureCollection | Feature): Geometry[] {
  return "features" in fc ? fc.features.map((f) => f.geometry) : [fc.geometry];
}

let geoPromise: Promise<Geo> | null = null;

function loadGeo(): Promise<Geo> {
  geoPromise ??= (async () => {
    const [{ feature, mesh }, { geoEquirectangular, geoPath }, land110Json, countries110Json, countries50Json] =
      await Promise.all([
        import("topojson-client"),
        import("d3-geo"),
        import("world-atlas/land-110m.json"),
        import("world-atlas/countries-110m.json"),
        import("world-atlas/countries-50m.json"),
      ]);
    type Topo = Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
    const land110 = (land110Json.default ?? land110Json) as unknown as Topo;
    const countries110 = (countries110Json.default ?? countries110Json) as unknown as Topo;
    const countries50 = (countries50Json.default ?? countries50Json) as unknown as Topo;

    const landGeoms = geometries(feature(land110, land110.objects.land) as unknown as FeatureCollection | Feature);
    const lives50 = feature(countries50, countries50.objects.countries) as FeatureCollection;
    const livesGeoms = lives50.features.filter((f) => OPERATING_ISO_IDS.has(String(f.id))).map((f) => f.geometry);
    const borderGeom = mesh(countries110, countries110.objects.countries, (a, b) => a !== b) as unknown as Geometry;

    // Rasterise land (red) and the operating countries (green) over the side of the world the hero
    // can show, then sample it for the texture and to keep customer records on land.
    const W0 = 40,
      W1 = 172,
      N = 62,
      S = -56,
      K = 12; // px per degree
    const W = (W1 - W0) * K;
    const H = (N - S) * K;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2d canvas unavailable");
    const proj = geoEquirectangular()
      .scale(K / RAD)
      .translate([-W0 * K, N * K]);
    const path = geoPath(proj, ctx);
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    for (const g of landGeoms) path(g);
    ctx.fill();
    ctx.fillStyle = "#00ff00";
    ctx.beginPath();
    for (const g of livesGeoms) path(g);
    ctx.fill();
    const px = ctx.getImageData(0, 0, W, H).data;
    const classify = (lon: number, lat: number): 0 | 1 | 2 => {
      if (lon < W0 || lon >= W1 || lat > N || lat <= S) return 0;
      const x = Math.floor((lon - W0) * K);
      const y = Math.floor((N - lat) * K);
      const i = (y * W + x) * 4;
      if (px[i + 1] > 110) return 2;
      if (px[i] > 110) return 1;
      return 0;
    };

    return {
      land: toLines(landGeoms),
      lives: toLines(livesGeoms),
      borders: toLines([borderGeom]),
      texture: buildDotMatrix(classify, TEXTURE_SPACING_DEG, [REGION_LON, -2], 66),
      points: buildCustomerPoints(master.customers, (lon, lat) => classify(lon, lat) > 0),
    };
  })();
  return geoPromise;
}

// ---------- Colours: read from the theme tokens, resolved to rgb so they can be mixed ----------

type Rgb = [number, number, number];

interface Palette {
  space: Rgb;
  fg: Rgb;
  muted: Rgb;
  /** Live data: the request arcs (the `signal` token, teal only for live data) */
  live: Rgb;
  /** Duplicate records (the `stuck` coral) */
  dup: Rgb;
  font: string;
  mono: string;
}

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const probe = c.getContext("2d", { willReadFrequently: true })!;
  // Resolve any CSS colour (hex in dark, oklch in light) to rgb by painting one pixel.
  const rgb = (name: string, fallback: string): Rgb => {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = fallback;
    probe.fillStyle = v(name) || fallback;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  return {
    space: rgb("--canvas", "#060708"),
    fg: rgb("--foreground", "#e6e7e9"),
    muted: rgb("--muted-foreground", "#a0a5ab"),
    live: rgb("--signal", "#67b6c1"),
    dup: rgb("--stuck", "#f07a62"),
    font: cs.fontFamily || "sans-serif",
    mono: v("--font-mono") || "ui-monospace, monospace",
  };
}

function rgba(t: Rgb, a: number) {
  return `rgba(${t[0]},${t[1]},${t[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function easeInOut(t: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

/** Screen rectangle, CSS px. */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: Box, b: Box, pad = 0) =>
  a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad;

// ---------- Text on the map ----------

/** Smallest canvas text: 12px, and 12.5px for the uppercase country names. */
const TEXT_PX = 12;
const COUNTRY_PX = 12.5;
const COUNTRY_TRACK = 0.14;

/**
 * Where each country's name may go, [lon, lat], in order of preference: inside the country, away from
 * its entity marker, its record clusters and (checked on screen) the request arcs. Malaysia can fall back
 * to Borneo, Singapore to the sea beside it. A name with no free spot is left off.
 */
const COUNTRY_SPOTS: Record<CountryCode, [number, number][]> = {
  MM: [GLOBE_NODES.MM.labelAt, [95.7, 22.4], [97.4, 19.3], [95.2, 18.9], [97.6, 22.9], [94.7, 20.5], [96.9, 24.3]],
  TH: [GLOBE_NODES.TH.labelAt, [103.7, 15.2], [99.3, 17.7], [101.3, 18.8], [102.8, 14.6], [104.3, 16.4], [99.6, 15.2]],
  VN: [GLOBE_NODES.VN.labelAt, [108.35, 12.8], [107.3, 15.7], [104.9, 21.7], [106.0, 19.2], [107.8, 14.9]],
  MY: [GLOBE_NODES.MY.labelAt, [102.95, 3.55], [103.2, 4.3], [102.2, 5.3], [101.05, 5.5], [111.5, 2.2], [116.5, 5.3]],
  SG: [[103.85, 0.6], [104.8, 1.05], [102.9, 0.75], [104.3, 0.45]],
};

interface LabelText {
  /** The record the label points at */
  code: string;
  title: string;
  sub: string;
  /** Places to try, as label-anchor offsets from the record in CSS px; the first that fits is used */
  at: [number, number][];
}

interface RecordLabel extends LabelText {
  /** What the label says, and where it points, once the merge has run */
  after?: LabelText;
  mono?: boolean;
}

/** Labels on the records worth pointing out (names and facts from dedup.json and the seed). */
const RECORD_LABELS: RecordLabel[] = [
  {
    code: "C-SG-00074",
    title: "Hosp Taman Seri",
    sub: "SG-coded duplicate of C-MY-00066",
    at: [[36, 30], [42, -30], [-36, 22], [36, 64], [-30, 58], [-30, 86], [-46, -34]],
    after: {
      code: "C-MY-00066",
      title: "Hospital Taman Seri",
      sub: "C-MY-00066 · SG duplicate merged",
      at: [[-56, -22], [-48, 26], [-60, 6], [52, -30], [-40, -52], [40, 30]],
    },
  },
  {
    code: "C-MY-00029",
    title: "Bukit Damai Specialist Hospital",
    sub: "3 records in SAP",
    at: [[-64, 30], [-40, 58], [70, 36], [-70, -24], [24, -40]],
    after: {
      code: "C-MY-00029",
      title: "Bukit Damai Specialist Hospital",
      sub: "1 customer · #2 in Malaysia by sales",
      at: [[-64, 30], [-40, 58], [70, 36], [-70, -24], [24, -40]],
    },
  },
  {
    code: "C-SG-00017",
    title: "National University Hospital",
    sub: "C-SG-00017",
    at: [[-30, 44], [30, 46], [-110, 22], [-24, 78], [34, 80], [-150, 36], [-60, -44]],
    mono: true,
  },
];

const LINE_H = 15;

/** Fallback places for a record label after its own: a ring of offsets, nearest and sideways first. */
const RING: [number, number][] = [34, 56, 82, 112].flatMap((r) =>
  [-30, 30, -150, 150, -60, 60, -120, 120, 0, 180, -90, 90].map(
    (a): [number, number] => [Math.round(r * Math.cos(a * RAD)), Math.round(r * Math.sin(a * RAD))],
  ),
);

/** Split at the space nearest the middle (for a label that does not fit on one line). */
function halves(s: string): string[] {
  if (s.length < 18) return [s];
  const mid = s.length / 2;
  let best = -1;
  for (let i = 0; i < s.length; i++) if (s[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? [s] : [s.slice(0, best), s.slice(best + 1)];
}

/** A record label's lines (name, then fact), with its width and height including the leader's tick. */
function labelBlock(ctx: CanvasRenderingContext2D, pal: Palette, text: LabelText, mono: boolean, wrap: boolean) {
  const titleFont = `500 ${TEXT_PX}px ${pal.font}`;
  const subFont = mono ? `400 ${TEXT_PX}px ${pal.mono}` : `400 ${TEXT_PX}px ${pal.font}`;
  const lines = [
    ...(wrap ? halves(text.title) : [text.title]).map((t) => ({ text: t, font: titleFont, title: true })),
    ...(wrap ? halves(text.sub) : [text.sub]).map((t) => ({ text: t, font: subFont, title: false })),
  ];
  let w = 0;
  for (const l of lines) {
    ctx.font = l.font;
    w = Math.max(w, ctx.measureText(l.text).width);
  }
  return { lines, w: w + 11, h: lines.length * LINE_H + 5 };
}

/** The entity marker with its code and count, as a box other text keeps clear of. */
function hubBox(x: number, y: number, isHub: boolean): Box {
  const s = isHub ? 6.5 : 5;
  return { x0: x - s - 3, x1: x + s + 46, y0: y - s - 3, y1: y + s + 3 };
}

// ---------- The view ----------

const DEV = process.env.NODE_ENV !== "production";

/** Slow oscillation, not a spin, small enough that the region stays in its zone. */
const DRIFT_PERIOD_MS = 60_000;
/** Drift steps: the globe is redrawn each time the drift moves it this far (CSS px); raised if redraws are slow. */
const DRIFT_STEP_PX = 1;
const DRIFT_STEP_MAX_PX = 3;
/** A redraw slower than this raises the step (fewer, larger steps) */
const SLOW_REDRAW_MS = 12;
/** Per-step geometry kept (the drift swings back through the same steps) */
const STEP_CACHE = 48;

interface View {
  w: number;
  h: number;
  /** The fitted camera at zero drift */
  fit: CameraParams;
  driftDeg: number;
  /** How far one degree of drift moves the region, px */
  pxPerDeg: number;
  /** Arc height scale, so arcs keep the on-screen height they had on the smaller v1 globe */
  lift: number;
  /** The zone the region is fitted into: record labels stay inside it */
  zone: Box;
  /** Text and controls over the globe (headline, copy, the key): map text keeps clear of them */
  keepOut: Box[];
  /** The horizon fades out leftwards over this span, so it stays clear of the copy */
  fadeX0: number;
  fadeX1: number;
}

/** Projected geometry for one drift step (Path2D, CSS px). */
interface StepGeom {
  land: Path2D;
  lives: Path2D;
  borders: Path2D;
  /** Texture by kind (land, Lives country) × depth band */
  tex: Path2D[];
  /** Records by segment tier × brightness, and the rings on hospitals */
  fills: Path2D[];
  halos: Path2D;
  /** Duplicates and their links, shown before the merge */
  dupLinks: Path2D;
  dupDots: Path2D;
}

type MergeState = "pre" | "merging" | "post";

export interface GlobeHandle {
  redraw: () => void;
}

/**
 * The landing hero's background: a large globe seen in perspective from above and south of Southeast
 * Asia, so its horizon curves across the hero under the headline (after the Gotham site's hero, with our data).
 *
 * - Land: dark grey fill (world-atlas 110m; the five operating countries from 50m, a step brighter), a fine
 *   dot texture, faint borders, uppercase country names placed clear of markers and arcs. A thin light limb.
 * - One dot per customer record in the illustrative SAP extract (388), placed by postcode area. Size by
 *   segment (hospitals largest, with a faint ring) and by distance; dormant records dim. Duplicates (25)
 *   are coral, with a thin link to the record they duplicate; once, a few seconds in, they glide into it.
 * - The five entities as diamond markers with their code and live open-request count.
 * - Every teal arc is one open request in this browser's sandbox, from the country that raised it to the
 *   MDM team in Singapore, with a moving pulse; Singapore's own requests pulse as rings on the hub.
 *
 * Rendering: three stacked canvases, DPR-aware. The globe's body, shading and limb do not change with the
 * drift (it turns the globe about its axis), so they are drawn once per layout. Land, texture, records,
 * markers and labels are redrawn only when the drift moves them by a whole step (≥ 1px), from Path2D
 * geometry cached per step. Only the arcs and pulses are drawn every frame; with nothing in flight the loop
 * drops to ~30 fps. Pauses when scrolled out of view; one still frame under reduced motion. Hidden from
 * assistive tech: the hero's facts row and the open-requests panel say the same in words.
 */
export function RequestGlobe({
  zoneRef,
  headRef,
  keepOut: keepOutRefs,
  merge,
  highlightRef,
  apiRef,
  className,
}: {
  /** Element the region is fitted into (the hero's empty right-hand zone). Falls back to the canvas. */
  zoneRef?: RefObject<HTMLElement | null>;
  /** The headline block: the horizon is kept below it, so it never cuts through the headline */
  headRef?: RefObject<HTMLElement | null>;
  /** Text blocks over the globe (headline, copy): map text keeps clear of them */
  keepOut?: RefObject<HTMLElement | null>[];
  merge: MergeClock;
  /** Request id the open-requests panel is pointing at */
  highlightRef?: RefObject<string | null>;
  apiRef?: RefObject<GlobeHandle | null>;
  className?: string;
}) {
  const underRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const list = useGlobeRequests();
  const theme = useTheme();
  const reduce = useReducedMotion() ?? false;

  // Inputs the draw loop reads without restarting.
  const arcsRef = useRef<ArcPath[]>([]);
  const listRef = useRef<GlobeRequest[]>([]);
  const liftRef = useRef(1);
  const bornRef = useRef(new Map<string, number>());
  const hubRef = useRef<GlobeRequest[]>([]);
  const countsRef = useRef<Record<CountryCode, number>>(countByCountry([]));
  const paletteRef = useRef<Palette | null>(null);
  const reduceRef = useRef(reduce);
  const redrawRef = useRef({ kick: () => {}, restatic: () => {}, relabel: () => {} });

  useEffect(() => {
    const now = performance.now();
    listRef.current = list;
    const arcs = buildArcs(list, 48, liftRef.current);
    const born = bornRef.current;
    // First paint: arcs draw in one after another. Later (a request submitted while the page is
    // open, or after a reset): only the new arc draws in.
    const first = born.size === 0;
    arcs.forEach((a, i) => {
      if (!born.has(a.id)) born.set(a.id, first ? now + 300 + i * 110 : now);
    });
    arcsRef.current = arcs;
    hubRef.current = list.filter((r) => r.country === HUB);
    countsRef.current = countByCountry(list);
    // The arcs moved, so the country names may need other spots.
    redrawRef.current.relabel();
  }, [list]);

  useEffect(() => {
    const el = underRef.current;
    if (!el) return;
    paletteRef.current = readPalette(el);
    redrawRef.current.restatic();
  }, [theme]);

  useEffect(() => {
    reduceRef.current = reduce;
    redrawRef.current.restatic();
  }, [reduce]);

  // The merge clock moved (first start, or "Replay"): draw now, and under reduced motion draw again
  // when the merged state is due (no loop runs then).
  useEffect(() => {
    let timer = 0;
    const onChange = () => {
      redrawRef.current.restatic();
      window.clearTimeout(timer);
      const due = merge.start - performance.now();
      if (due > 0 && Number.isFinite(due)) timer = window.setTimeout(() => redrawRef.current.restatic(), due + 20);
    };
    const off = merge.subscribe(onChange);
    onChange();
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [merge]);

  useEffect(() => {
    if (apiRef) apiRef.current = { redraw: () => redrawRef.current.kick() };
    return () => {
      if (apiRef) apiRef.current = null;
    };
  }, [apiRef]);

  useEffect(() => {
    const under = underRef.current;
    const mid = midRef.current;
    const over = overRef.current;
    if (!under || !mid || !over) return;
    const uctx = under.getContext("2d");
    const mctx = mid.getContext("2d");
    const octx = over.getContext("2d");
    // Drift-invariant layers: the globe body and haze (under the land), the shading and limb (over it).
    const shellBelow = document.createElement("canvas");
    const shellAbove = document.createElement("canvas");
    const sbctx = shellBelow.getContext("2d");
    const sactx = shellAbove.getContext("2d");
    if (!uctx || !mctx || !octx || !sbctx || !sactx) return;

    let geo: Geo | null = null;
    /** Indices of lines / texture dots that can reach the screen anywhere in the drift (recomputed on layout). */
    let liveLand: number[] = [];
    let liveLives: number[] = [];
    let liveBorders: number[] = [];
    let liveTexture = new Uint32Array(0);
    let pointVecs: Vec3[] = [];
    let pointIndex = new Map<string, number>();
    /** Surviving record → codes of the duplicates that merge into it */
    let dupsOf = new Map<string, string[]>();
    let raf = 0;
    let onScreen = true;
    let disposed = false;
    let view: View | null = null;
    let dpr = 1;
    /** The one transform every layer draws with: hero CSS px, scaled to the backing store. */
    const prepare = (ctx: CanvasRenderingContext2D) => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let stepPx = DRIFT_STEP_PX;
    let lastDraw = 0;
    /** What the static layers were last drawn for; anything else means redraw them */
    let staticKey = "";
    let shellFor: Palette | null = null;
    let midBox: Box | null = null;
    /** Country-name spots and record-label places, chosen once per layout (and when the arcs change) */
    let countryPick: Map<CountryCode, [number, number]> | null = null;
    let countryBoxes: Box[] = [];
    const labelPick = new Map<string, { dx: number; dy: number; wrap: boolean } | null>();
    const camCache = new Map<number, Camera>();
    const geomCache = new Map<number, StepGeom>();
    /** Bumped on every layout: every cached projection is tied to the layout it was made in */
    let layoutId = 0;
    /** What the layout was measured from, to notice changes a ResizeObserver does not report */
    let measured = "";
    /** The frame (layout and drift step) each layer was last drawn with: they must always agree */
    const drawnWith = { under: "", over: "", mid: "" };
    /** Hub marker as drawn on the top layer (hero coordinates), for the dev self-check */
    let hubDrawn: { x: number; y: number } | null = null;
    /** The arcs projected for the current drift step (they only move when the step does) */
    let arcProj: { x: number; y: number }[][] = [];
    let arcProjKey = "";

    const camAt = (drift: number): Camera => {
      let cam = camCache.get(drift);
      if (!cam && view) {
        const f = view.fit;
        cam = makeCamera({ ...f, lon: f.lon + drift, target: [f.target[0] + drift, f.target[1]] });
        if (camCache.size > 96) camCache.clear();
        camCache.set(drift, cam);
      }
      return cam!;
    };

    const cull = () => {
      if (!geo || !view) return;
      const { w, h } = view;
      const cams = [-1, 0, 1].map((k) => camAt(k * view!.driftDeg));
      const seen = (x: number, y: number, z: number) => {
        for (const cam of cams) {
          const p = cam.project([x, y, z]);
          if (p.depth > -0.03 && p.x > -60 && p.x < w + 60 && p.y > -60 && p.y < h + 60) return true;
        }
        return false;
      };
      const lines = (l: Lines) => {
        const keep: number[] = [];
        for (let li = 0; li + 1 < l.starts.length; li++) {
          for (let i = l.starts[li]; i < l.starts[li + 1]; i++) {
            if (seen(l.xyz[i * 3], l.xyz[i * 3 + 1], l.xyz[i * 3 + 2])) {
              keep.push(li);
              break;
            }
          }
        }
        return keep;
      };
      liveLand = lines(geo.land);
      liveLives = lines(geo.lives);
      liveBorders = lines(geo.borders);
      const { xyz, kind } = geo.texture;
      const keep: number[] = [];
      for (let i = 0; i < kind.length; i++) if (seen(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2])) keep.push(i);
      liveTexture = Uint32Array.from(keep);
    };

    /** Hero size, zone and text boxes relative to the hero, and the DPR: anything that moves the projection. */
    const fingerprint = () => {
      const r = under.getBoundingClientRect();
      const rel = (el: Element | null | undefined) => {
        if (!el) return "";
        const b = el.getBoundingClientRect();
        return `${Math.round(b.left - r.left)},${Math.round(b.top - r.top)},${Math.round(b.width)},${Math.round(b.height)}`;
      };
      return [
        Math.round(r.width),
        Math.round(r.height),
        window.devicePixelRatio,
        rel(zoneRef?.current),
        ...(keepOutRefs ?? []).map((k) => rel(k.current)),
        rel(mid),
      ].join("|");
    };

    const invalidate = () => {
      geomCache.clear();
      camCache.clear();
      labelPick.clear();
      countryPick = null;
      shellFor = null;
      staticKey = "";
      arcProjKey = "";
    };

    const layout = () => {
      const rect = under.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Every layer has the same size and the same transform (`prepare`): one projection, one frame.
      for (const c of [under, mid, over, shellBelow, shellAbove]) {
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
      }
      const z = zoneRef?.current?.getBoundingClientRect();
      const zone =
        z && z.width > 120 && z.height > 120
          ? { x: z.left - rect.left, y: z.top - rect.top, w: z.width, h: z.height }
          : { x: w * 0.3, y: h * 0.12, w: w * 0.66, h: h * 0.5 };
      layoutId++;
      measured = fingerprint();
      const box = (el: Element, pad: number): Box => {
        const r = el.getBoundingClientRect();
        return { x0: r.left - rect.left - pad, y0: r.top - rect.top - pad, x1: r.right - rect.left + pad, y1: r.bottom - rect.top + pad };
      };
      const keepOut = [
        ...Array.from(zoneRef?.current?.children ?? []).map((el) => box(el, 4)),
        ...(keepOutRefs ?? []).flatMap((r) => (r.current ? [box(r.current, 8)] : [])),
      ];
      const key = Array.from(zoneRef?.current?.children ?? []).map((el) => box(el, 0));
      const keyTop = Math.min(zone.y + zone.h, ...key.filter((b) => b.y1 > zone.y).map((b) => b.y0));

      // The drift swings the region sideways by `swing` px each way, so fit it inside that margin.
      const swing = Math.min(24, Math.max(10, zone.w * 0.03));
      // The horizon sits just under the headline (never across it); the region below it, clear of the key.
      const head = headRef?.current?.getBoundingClientRect();
      const headBottom = head && head.height > 0 ? head.bottom - rect.top : 0;
      // (No headline above the zone: the horizon sits near the top, clear of the status bar's edge.)
      const limbTop = headBottom > 0 ? headBottom + 12 : Math.max(30, h * 0.04);
      const top = Math.max(zone.y, h * 0.08, limbTop + 40);
      const fitZone = { x: zone.x + swing, y: top, w: Math.max(80, zone.w - 2 * swing), h: Math.max(80, keyTop - 8 - top) };
      const pxPerDegOf = (fit: CameraParams) => {
        const c0 = makeCamera(fit);
        const p0 = c0.project(toVec(fit.target));
        const p1 = c0.project(toVec([fit.target[0] + 1, fit.target[1]]));
        return Math.max(1, Math.hypot(p1.x - p0.x, p1.y - p0.y));
      };
      const liftOf = (pxPerDeg: number) => Math.min(1, Math.max(0.4, 1650 / (pxPerDeg / RAD)));
      // Fit twice: the second time with the tops of the arcs (as many lanes per country as are open,
      // at least two) so no arc apex is cut off above the region.
      let fit = fitCamera(fitZone, limbTop);
      const counts = countsRef.current;
      const probe: GlobeRequest[] = [];
      for (const c of ["MY", "TH", "VN", "MM"] as CountryCode[])
        for (let i = 0; i < Math.max(2, counts[c]); i++) probe.push({ id: `${c}-${i}`, country: c });
      const apexes = buildArcs(probe, 12, liftOf(pxPerDegOf(fit))).flatMap((a) => a.points.slice(3, 10));
      fit = fitCamera(fitZone, limbTop, { extra: apexes });
      const pxPerDeg = pxPerDegOf(fit);

      view = {
        w,
        h,
        fit,
        driftDeg: swing / pxPerDeg,
        pxPerDeg,
        lift: liftOf(pxPerDeg),
        zone: { x0: zone.x, y0: zone.y, x1: zone.x + zone.w, y1: zone.y + zone.h },
        keepOut,
        fadeX0: zone.x - 160,
        fadeX1: zone.x + 90,
      };
      stepPx = DRIFT_STEP_PX;
      invalidate();
      if (Math.abs(view.lift - liftRef.current) > 1e-3) {
        liftRef.current = view.lift;
        arcsRef.current = buildArcs(listRef.current, 48, view.lift);
      }
      cull();
    };

    const mergeState = (now: number): { state: MergeState; elapsed: number } => {
      const still = reduceRef.current;
      if (now < merge.start) return { state: "pre", elapsed: -1 };
      const elapsed = now - merge.start;
      if (still || elapsed >= MERGE_TOTAL_MS) return { state: "post", elapsed: Infinity };
      return { state: "merging", elapsed };
    };

    /** Perspective size factor: nearer records are drawn a little larger. */
    const sizeAt = (cam: Camera, z: number) => Math.min(1.45, Math.max(0.7, cam.zRef / z));

    // ----- Drift-invariant layers (once per layout and theme) -----
    const buildShell = () => {
      const pal = paletteRef.current;
      if (!view || !pal) return;
      const { w, h, fadeX0, fadeX1 } = view;
      const { space, fg } = pal;
      const hz = camAt(0).horizon();
      for (const ctx of [sbctx, sactx]) {
        prepare(ctx);
        ctx.clearRect(0, 0, w, h);
      }
      shellFor = pal;
      if (hz.length < 3) return;
      const horizon = new Path2D();
      hz.forEach((q, i) => (i ? horizon.lineTo(q.x, q.y) : horizon.moveTo(q.x, q.y)));
      horizon.closePath();
      // The horizon's light fades out towards the copy on the left (full strength over the region).
      const lit = (ctx: CanvasRenderingContext2D, a: number) => {
        const g = ctx.createLinearGradient(fadeX0, 0, fadeX1, 0);
        g.addColorStop(0, rgba(fg, 0));
        g.addColorStop(1, rgba(fg, a));
        return g;
      };

      // Below the land: a faint haze outside the horizon, then the globe body.
      let ctx = sbctx;
      ctx.lineJoin = "round";
      for (const [lw, a] of [
        [44, 0.025],
        [24, 0.035],
        [11, 0.055],
        [4, 0.08],
      ] as const) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = lit(ctx, a);
        ctx.stroke(horizon);
      }
      ctx.fillStyle = rgba(mix(space, fg, 0.04), 1);
      ctx.fill(horizon);

      // Over the land: the surface darkens just inside the horizon, under a thin bright rim.
      ctx = sactx;
      ctx.save();
      ctx.clip(horizon);
      ctx.lineJoin = "round";
      for (const [lw, a] of [
        [300, 0.16],
        [170, 0.16],
        [80, 0.18],
        [30, 0.16],
      ] as const) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = rgba(space, a);
        ctx.stroke(horizon);
      }
      for (const [lw, a] of [
        [18, 0.05],
        [7, 0.09],
      ] as const) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = lit(ctx, a);
        ctx.stroke(horizon);
      }
      ctx.restore();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = lit(ctx, 0.62);
      ctx.stroke(horizon);
    };

    // ----- Projected geometry for one drift step, cached -----
    const buildGeom = (cam: Camera): StepGeom => {
      const g: StepGeom = {
        land: new Path2D(),
        lives: new Path2D(),
        borders: new Path2D(),
        tex: Array.from({ length: 6 }, () => new Path2D()),
        fills: Array.from({ length: 12 }, () => new Path2D()),
        halos: new Path2D(),
        dupLinks: new Path2D(),
        dupDots: new Path2D(),
      };
      if (!geo || !view) return g;
      const { w, h } = view;
      const project = cam.project;
      const u = cam.u;
      const lim = 1 / cam.params.D;
      // Land: points behind the horizon are pinned to it, so land that runs over the edge fills up to it.
      const rings = (p: Path2D, lines: Lines, live: number[]) => {
        const { xyz, starts } = lines;
        for (const li of live) {
          for (let i = starts[li]; i < starts[li + 1]; i++) {
            let v: readonly number[] = [xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]];
            if (v[0] * u[0] + v[1] * u[1] + v[2] * u[2] < lim) v = cam.pin(v);
            const s = project(v);
            if (i === starts[li]) p.moveTo(s.x, s.y);
            else p.lineTo(s.x, s.y);
          }
          p.closePath();
        }
      };
      rings(g.land, geo.land, liveLand);
      rings(g.lives, geo.lives, liveLives);
      // Borders: open lines, cut where they pass behind the horizon.
      {
        const { xyz: q, starts } = geo.borders;
        for (const li of liveBorders) {
          let pen = false;
          for (let i = starts[li]; i < starts[li + 1]; i++) {
            const s = project([q[i * 3], q[i * 3 + 1], q[i * 3 + 2]]);
            if (s.depth < 0.005) {
              pen = false;
              continue;
            }
            if (pen) g.borders.lineTo(s.x, s.y);
            else g.borders.moveTo(s.x, s.y);
            pen = true;
          }
        }
      }
      // Texture: dots on the sphere, by kind and by depth band (they fade towards the horizon).
      {
        const { xyz, kind } = geo.texture;
        for (let k = 0; k < liveTexture.length; k++) {
          const i = liveTexture[k];
          const s = project([xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]]);
          if (s.depth <= 0.02 || s.x < -2 || s.x > w + 2 || s.y < -2 || s.y > h + 2) continue;
          const size = 1.05 * Math.min(1.3, Math.max(0.75, cam.zRef / s.z));
          const band = s.depth > 0.3 ? 2 : s.depth > 0.12 ? 1 : 0;
          g.tex[(kind[i] === 2 ? 3 : 0) + band].rect(s.x - size / 2, s.y - size / 2, size, size);
        }
      }
      // Records: size by segment and distance, hospitals ringed, dormant records dim; duplicates apart.
      const radius = [1.15, 1.45, 1.8, 2.35];
      const pts = geo.points;
      const sp = pointVecs.map((v) => project(v));
      pts.forEach((p, i) => {
        const s = sp[i];
        if (s.depth <= 0.01 || s.x < -6 || s.x > w + 6 || s.y < -6 || s.y > h + 6) return;
        const k = sizeAt(cam, s.z);
        if (p.dup) {
          const gp = sp[pointIndex.get(p.goldenCode)!];
          g.dupLinks.moveTo(s.x, s.y);
          g.dupLinks.lineTo(gp.x, gp.y);
          g.dupDots.moveTo(s.x + 2.1 * k, s.y);
          g.dupDots.arc(s.x, s.y, 2.1 * k, 0, Math.PI * 2);
          return;
        }
        const rad = radius[p.tier] * k;
        const level = p.dormant ? 0 : 1 + Math.floor(hashUnit(p.code) * 2);
        g.fills[p.tier * 3 + level].moveTo(s.x + rad, s.y);
        g.fills[p.tier * 3 + level].arc(s.x, s.y, rad, 0, Math.PI * 2);
        if (p.tier === 3) {
          g.halos.moveTo(s.x + rad + 1.9 * k, s.y);
          g.halos.arc(s.x, s.y, rad + 1.9 * k, 0, Math.PI * 2);
        }
      });
      return g;
    };

    const geomAt = (k: number, cam: Camera): StepGeom => {
      let g = geomCache.get(k);
      if (g) {
        geomCache.delete(k);
        geomCache.set(k, g);
        return g;
      }
      const t0 = performance.now();
      g = buildGeom(cam);
      geomCache.set(k, g);
      if (geomCache.size > STEP_CACHE) geomCache.delete(geomCache.keys().next().value!);
      // Slow machine: take larger (fewer) drift steps.
      if (geo && performance.now() - t0 > SLOW_REDRAW_MS && stepPx < DRIFT_STEP_MAX_PX) {
        stepPx = Math.min(DRIFT_STEP_MAX_PX, stepPx + 0.5);
        geomCache.clear();
      }
      return g;
    };

    // ----- Country names: a free spot for each, chosen at zero drift -----
    // Each name takes its cheapest spot: never on the copy, an entity marker or another name; an arc
    // under it costs a lot, a record dot a little. Names with no spot at all are left off.
    const pickCountries = (pal: Palette) => {
      if (!view) return;
      const cam = camAt(0);
      const ctx = uctx;
      const hard: Box[] = [...view.keepOut];
      for (const node of Object.values(GLOBE_NODES)) {
        const p = cam.project(toVec(node.at));
        hard.push(hubBox(p.x, p.y, node.code === HUB));
      }
      const arcPts: Box[] = [];
      for (const arc of arcsRef.current)
        for (const pt of arc.points) {
          const p = cam.project(pt);
          arcPts.push({ x0: p.x - 3, x1: p.x + 3, y0: p.y - 3, y1: p.y + 3 });
        }
      const dots: Box[] = [];
      for (const v of pointVecs) {
        const p = cam.project(v);
        if (p.depth > 0.01) dots.push({ x0: p.x - 2, x1: p.x + 2, y0: p.y - 2, y1: p.y + 2 });
      }
      ctx.font = `500 ${COUNTRY_PX}px ${pal.font}`;
      ctx.letterSpacing = "0px";
      countryPick = new Map();
      countryBoxes = [];
      for (const code of ["MY", "TH", "VN", "MM", "SG"] as CountryCode[]) {
        const name = GLOBE_NODES[code].name.toUpperCase();
        const half = (ctx.measureText(name).width + name.length * COUNTRY_TRACK * COUNTRY_PX) / 2 + 2;
        let best: { spot: [number, number]; box: Box; cost: number } | null = null;
        COUNTRY_SPOTS[code].forEach((spot, rank) => {
          const p = cam.project(toVec(spot));
          if (p.depth <= 0.03) return;
          const b = { x0: p.x - half, x1: p.x + half, y0: p.y - 8, y1: p.y + 8 };
          if (b.x0 < 4 || b.x1 > view!.w - 4 || b.y0 < 4 || b.y1 > view!.h - 4) return;
          if (hard.some((q) => overlaps(b, q, 2)) || countryBoxes.some((q) => overlaps(b, q, 6))) return;
          const cost =
            12 * arcPts.filter((q) => overlaps(b, q)).length + dots.filter((q) => overlaps(b, q)).length + rank * 0.5;
          if (!best || cost < best.cost) best = { spot, box: b, cost };
        });
        if (best) {
          const { spot, box } = best;
          countryPick.set(code, spot);
          countryBoxes.push(box);
        }
      }
    };

    // ----- Under: land, texture, borders, country names, records (between the two shell layers) -----
    const drawUnder = (k: number, cam: Camera, state: MergeState) => {
      const pal = paletteRef.current;
      if (!view || !pal) return;
      const { w, h } = view;
      const ctx = uctx;
      if (shellFor !== pal) buildShell();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, under.width, under.height);
      ctx.drawImage(shellBelow, 0, 0);
      prepare(ctx);
      const { space, fg } = pal;

      const g = geo ? geomAt(k, cam) : null;
      if (g) {
        ctx.fillStyle = rgba(mix(space, fg, 0.085), 1);
        ctx.fill(g.land);
        ctx.fillStyle = rgba(mix(space, fg, 0.125), 1);
        ctx.fill(g.lives);
        const fades = [0.35, 0.65, 1];
        for (let b = 0; b < 3; b++) {
          ctx.fillStyle = rgba(fg, 0.15 * fades[b]);
          ctx.fill(g.tex[b]);
          ctx.fillStyle = rgba(fg, 0.27 * fades[b]);
          ctx.fill(g.tex[3 + b]);
        }
        ctx.lineJoin = "round";
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = rgba(fg, 0.1);
        ctx.stroke(g.land);
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = rgba(fg, 0.16);
        ctx.stroke(g.borders);
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = rgba(fg, 0.34);
        ctx.stroke(g.lives);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(shellAbove, 0, 0);
      prepare(ctx);

      // Country names: small uppercase grey map labels, on their chosen spots.
      if (!countryPick) pickCountries(pal);
      ctx.font = `500 ${COUNTRY_PX}px ${pal.font}`;
      ctx.letterSpacing = `${COUNTRY_TRACK}em`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(pal.muted, 0.95);
      for (const [code, spot] of countryPick ?? []) {
        const p = cam.project(toVec(spot));
        if (p.depth <= 0.02 || p.x < -80 || p.x > w + 80 || p.y < -20 || p.y > h + 20) continue;
        ctx.fillText(GLOBE_NODES[code].name.toUpperCase(), p.x, p.y);
      }
      ctx.letterSpacing = "0px";

      if (!g) return;
      if (state === "pre") {
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = rgba(pal.dup, 0.6);
        ctx.stroke(g.dupLinks);
      }
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = rgba(pal.fg, 0.32);
      ctx.stroke(g.halos);
      const levels = [0.38, 0.78, 0.97];
      for (let t = 0; t < 4; t++)
        for (let l = 0; l < 3; l++) {
          ctx.fillStyle = rgba(pal.fg, levels[l]);
          ctx.fill(g.fills[t * 3 + l]);
        }
      if (state === "pre") {
        ctx.fillStyle = rgba(pal.dup, 0.95);
        ctx.fill(g.dupDots);
      }
    };

    /** Nothing on the live layers may draw over text: clip out the copy and the facts row. */
    const clipOutText = (ctx: CanvasRenderingContext2D) => {
      if (!view || view.keepOut.length === 0) return;
      const p = new Path2D();
      p.rect(-1e5, -1e5, 2e5, 2e5);
      for (const b of view.keepOut) p.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      ctx.clip(p, "evenodd");
    };

    // ----- Over: entity markers and the record labels -----
    const drawOver = (cam: Camera, state: MergeState, elapsed: number) => {
      const pal = paletteRef.current;
      if (!view || !pal) return;
      const { w, h } = view;
      const ctx = octx;
      prepare(ctx);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      clipOutText(ctx);

      // Entity markers: diamonds with the entity code and its live open-request count.
      const counts = countsRef.current;
      const placed: Box[] = [...countryBoxes];
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.lineJoin = "round";
      for (const node of Object.values(GLOBE_NODES)) {
        const p = cam.project(toVec(node.at));
        if (p.depth <= 0.01 || p.x < -40 || p.x > w + 40 || p.y < -20 || p.y > h + 20) continue;
        const isHub = node.code === HUB;
        if (isHub) hubDrawn = { x: p.x, y: p.y };
        placed.push(hubBox(p.x, p.y, isHub));
        const s = isHub ? 6.5 : 5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s);
        ctx.lineTo(p.x + s, p.y);
        ctx.lineTo(p.x, p.y + s);
        ctx.lineTo(p.x - s, p.y);
        ctx.closePath();
        ctx.fillStyle = rgba(pal.space, 0.92);
        ctx.fill();
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = rgba(pal.fg, 0.95);
        ctx.stroke();
        if (isHub) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = rgba(pal.fg, 1);
          ctx.fill();
        }
        const lx = p.x + s + 5;
        ctx.font = `500 ${TEXT_PX}px ${pal.mono}`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = rgba(pal.space, 0.85);
        ctx.strokeText(node.code, lx, p.y + 0.5);
        ctx.fillStyle = rgba(pal.fg, 1);
        ctx.fillText(node.code, lx, p.y + 0.5);
        const n = counts[node.code];
        if (n > 0) {
          const cw = ctx.measureText(node.code).width;
          ctx.font = `600 ${TEXT_PX}px ${pal.font}`;
          ctx.strokeText(String(n), lx + cw + 5, p.y + 0.5);
          ctx.fillStyle = rgba(pal.live, 1);
          ctx.fillText(String(n), lx + cw + 5, p.y + 0.5);
        }
      }

      // Labels on the records that carry the story, with leader lines.
      if (!geo) {
        ctx.restore();
        return;
      }
      const zone = view.zone;
      // Labels whose place is already settled go first, so a label placed now keeps clear of them.
      const settled = (l: RecordLabel) => labelPick.has(`${l.code}|${l.title}|${l.sub}`);
      const ordered = [...RECORD_LABELS].sort((a, c) => Number(settled(c)) - Number(settled(a)));
      for (const lab of ordered) {
        let text: LabelText = lab;
        if (lab.after && state !== "pre") {
          // A label on a duplicate hides while it glides; one on a surviving record changes once its duplicates are in.
          const moving = geo.points[pointIndex.get(lab.code) ?? 0]?.dup ?? false;
          const u =
            state === "post"
              ? 1
              : moving
                ? mergeProgress(lab.code, elapsed)
                : Math.min(1, ...(dupsOf.get(lab.code) ?? []).map((c) => mergeProgress(c, elapsed)));
          if (u >= 1) text = lab.after;
          else if (moving && u > 0) continue;
        }
        const i = pointIndex.get(text.code);
        if (i === undefined) continue;
        const pos = cam.project(pointVecs[i]);
        if (pos.depth <= 0.02) continue;

        // The first place inside the globe's zone that is clear of the copy, the key, the markers, the
        // country names and the labels already drawn: one line each for name and fact if they fit, else
        // wrapped; no place, no label. Chosen once per layout, so the drift never makes a label jump.
        const key = `${text.code}|${text.title}|${text.sub}`;
        let pick = labelPick.get(key);
        if (pick === undefined) {
          pick = null;
          for (const wrap of [false, true]) {
            const block = labelBlock(ctx, pal, text, !!lab.mono, wrap);
            for (const [cdx, cdy] of [...text.at, ...RING]) {
              const ax = pos.x + cdx;
              const ay = pos.y + cdy;
              const b = {
                x0: cdx >= 0 ? ax : ax - block.w,
                x1: cdx >= 0 ? ax + block.w : ax,
                y0: ay - 14,
                y1: ay - 14 + block.h,
              };
              if (b.x0 < zone.x0 - 12 || b.x1 > w - 6 || b.y0 < zone.y0 || b.y1 > zone.y1) continue;
              if (view.keepOut.some((q) => overlaps(b, q))) continue;
              if (placed.some((q) => overlaps(b, q, 4))) continue;
              pick = { dx: cdx, dy: cdy, wrap };
              break;
            }
            if (pick) break;
          }
          labelPick.set(key, pick);
        }
        if (!pick) continue;
        const block = labelBlock(ctx, pal, text, !!lab.mono, pick.wrap);
        const ax = pos.x + pick.dx;
        const ay = pos.y + pick.dy;
        const right = pick.dx >= 0;
        placed.push({ x0: right ? ax : ax - block.w, x1: right ? ax + block.w : ax, y0: ay - 14, y1: ay - 14 + block.h });

        ctx.beginPath();
        ctx.moveTo(pos.x + Math.sign(pick.dx) * 3, pos.y + Math.sign(pick.dy) * 3);
        ctx.lineTo(ax, ay);
        ctx.lineTo(ax + (right ? 8 : -8), ay);
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = rgba(pal.muted, 0.7);
        ctx.stroke();
        const tx = ax + (right ? 11 : -11);
        ctx.textAlign = right ? "left" : "right";
        ctx.textBaseline = "alphabetic";
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = rgba(pal.space, 0.88);
        block.lines.forEach((line, n) => {
          ctx.font = line.font;
          ctx.strokeText(line.text, tx, ay - 1 + n * LINE_H);
          ctx.fillStyle = line.title ? rgba(pal.fg, 0.95) : rgba(pal.muted, 1);
          ctx.fillText(line.text, tx, ay - 1 + n * LINE_H);
        });
      }
      ctx.restore();
    };

    // ----- Mid (every frame): the merge in motion, the arcs and pulses, Singapore's rings -----
    const drawMid = (k: number, cam: Camera, now: number, state: MergeState, elapsed: number) => {
      const pal = paletteRef.current;
      if (!view || !pal) return;
      const ctx = mctx;
      const still = reduceRef.current;
      prepare(ctx);
      if (midBox) ctx.clearRect(midBox.x0, midBox.y0, midBox.x1 - midBox.x0, midBox.y1 - midBox.y0);
      ctx.save();
      clipOutText(ctx);
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      const grow = (x: number, y: number, pad: number) => {
        x0 = Math.min(x0, x - pad);
        y0 = Math.min(y0, y - pad);
        x1 = Math.max(x1, x + pad);
        y1 = Math.max(y1, y + pad);
      };
      const highlight = highlightRef?.current ?? null;

      if (geo && state === "merging") {
        const pts = geo.points;
        pts.forEach((p, i) => {
          if (!p.dup) return;
          const gi = pointIndex.get(p.goldenCode)!;
          const g = cam.project(pointVecs[gi]);
          const u = mergeProgress(p.code, elapsed);
          if (u >= 1) {
            const since = elapsed - mergeOffsetMs(p.code) - MERGE_GLIDE_MS;
            if (since < 700) {
              const t = since / 700;
              ctx.beginPath();
              ctx.arc(g.x, g.y, 3 + 9 * t, 0, Math.PI * 2);
              ctx.lineWidth = 1.2;
              ctx.strokeStyle = rgba(pal.fg, 0.75 * (1 - t));
              ctx.stroke();
              grow(g.x, g.y, 14);
            }
            return;
          }
          const at = cam.project(u > 0 ? slerp(pointVecs[i], pointVecs[gi], easeInOut(u)) : pointVecs[i]);
          if (at.depth <= 0.01) return;
          ctx.beginPath();
          ctx.moveTo(at.x, at.y);
          ctx.lineTo(g.x, g.y);
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = rgba(pal.dup, 0.6 * (1 - u * 0.6));
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(at.x, at.y, 2.1 * sizeAt(cam, at.z), 0, Math.PI * 2);
          ctx.fillStyle = rgba(pal.dup, 0.95);
          ctx.fill();
          grow(at.x, at.y, 5);
          grow(g.x, g.y, 5);
        });
      }

      // Arcs (from v1): one per open request, origin → Singapore, with a travelling pulse.
      const arcs = arcsRef.current;
      const projKey = `${layoutId}|${k}|${stepPx}|${arcs.map((a) => a.id).join(",")}|${liftRef.current}`;
      if (projKey !== arcProjKey) {
        arcProj = arcs.map((a) => a.points.map((p) => {
          const q = cam.project(p);
          return { x: q.x, y: q.y };
        }));
        arcProjKey = projKey;
      }
      ctx.lineCap = "round";
      for (let ai = 0; ai < arcs.length; ai++) {
        const arc = arcs[ai];
        const pts = arcProj[ai];
        const last = pts.length - 1;
        const born = bornRef.current.get(arc.id) ?? 0;
        const g = still ? 1 : Math.min(1, Math.max(0, (now - born) / 1100));
        if (g <= 0) continue;
        const dim = highlight && highlight !== arc.id ? 0.3 : 1;
        const lit = highlight === arc.id;
        const reach = easeInOut(g) * last;
        const at = (u: number) => {
          const i = Math.min(last - 1, Math.max(0, Math.floor(u)));
          const k = u - i;
          return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
        };

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= Math.floor(reach); i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (reach < last) {
          const p = at(reach);
          ctx.lineTo(p.x, p.y);
        }
        ctx.lineWidth = lit ? 2 : 1.25;
        ctx.strokeStyle = rgba(pal.live, (lit ? 1 : 0.6) * dim);
        ctx.stroke();
        for (const p of pts) grow(p.x, p.y, 6);
        if (g < 1) continue;

        // The pulse: travels, arrives, rests, goes again.
        const rest = 1.6;
        const cycle = arc.period + rest;
        const tSec = still ? arc.period * 0.62 : (now / 1000 + arc.phase * cycle) % cycle;
        if (tSec > arc.period) continue;
        const head = easeInOut(tSec / arc.period) * last;
        const tail = Math.max(0, head - last * 0.24);
        const steps = 10;
        let prev = at(tail);
        for (let s = 1; s <= steps; s++) {
          const p = at(tail + ((head - tail) * s) / steps);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(p.x, p.y);
          ctx.lineWidth = 1.1 + (s / steps) * 1.3;
          ctx.strokeStyle = rgba(pal.live, (s / steps) * 0.95 * dim);
          ctx.stroke();
          prev = p;
        }
        ctx.beginPath();
        ctx.arc(prev.x, prev.y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = rgba(pal.live, dim);
        ctx.fill();
      }

      // Singapore's own requests: rings on the hub.
      const hub = cam.project(toVec(GLOBE_NODES[HUB].at));
      hubRef.current.forEach((req) => {
        const period = 3.4;
        const u = still ? 0.45 : (now / 1000 / period + hashUnit(req.id)) % 1;
        const grown = 1 - (1 - u) * (1 - u);
        const dim = highlight && highlight !== req.id ? 0.3 : 1;
        ctx.beginPath();
        ctx.arc(hub.x, hub.y, 9 + 24 * grown, 0, Math.PI * 2);
        ctx.lineWidth = highlight === req.id ? 2 : 1.3;
        ctx.strokeStyle = rgba(pal.live, 0.85 * (1 - u) * dim);
        ctx.stroke();
        grow(hub.x, hub.y, 36);
      });

      ctx.restore();
      midBox = Number.isFinite(x0) ? { x0: Math.floor(x0), y0: Math.floor(y0), x1: Math.ceil(x1), y1: Math.ceil(y1) } : null;
    };

    const draw = (now: number) => {
      if (!view || !paletteRef.current) return;
      lastDraw = now;
      const still = reduceRef.current;
      const raw = still ? 0 : Math.sin((now / DRIFT_PERIOD_MS) * Math.PI * 2) * view.driftDeg;
      const stepDeg = stepPx / view.pxPerDeg;
      const k = Math.round(raw / stepDeg);
      const cam = camAt(k * stepDeg);
      const { state, elapsed } = mergeState(now);
      const counts = countsRef.current;
      // One frame, one camera: every layer drawn in this call uses `cam`, made in layout `layoutId`.
      const frame = `${layoutId}|${k}|${stepPx}`;
      const key = `${frame}|${state}|${geo ? 1 : 0}|${counts.SG},${counts.MY},${counts.TH},${counts.VN},${counts.MM}`;
      if (key !== staticKey) {
        drawUnder(k, cam, state);
        drawnWith.under = frame;
        staticKey = key;
        if (state !== "merging") {
          drawOver(cam, state, elapsed);
          drawnWith.over = frame;
        }
      }
      // While the merge runs, labels change as records land.
      if (state === "merging") {
        drawOver(cam, state, elapsed);
        drawnWith.over = frame;
      }
      drawMid(k, cam, now, state, elapsed);
      drawnWith.mid = frame;
      if (DEV) selfCheck();
    };

    /**
     * Dev self-check: all three layers come from the same frame, and every arc ends exactly on the hub
     * marker, compared in page coordinates through the canvases' real positions (so a layer that CSS has
     * moved is caught too). On a mismatch: say so once and lay out again.
     */
    let warned = false;
    const checkNumbers = () => {
      if (!view || !hubDrawn) return null;
      const ur = under.getBoundingClientRect();
      const or = over.getBoundingClientRect();
      const mr = mid.getBoundingClientRect();
      // Page position of a hero point drawn on a canvas: its box, scaled by box size / layout size.
      const page = (r: DOMRect, x: number, y: number) => ({
        x: r.left + (x * r.width) / view!.w,
        y: r.top + (y * r.height) / view!.h,
      });
      const hub = page(or, hubDrawn.x, hubDrawn.y);
      let worst = 0;
      for (const pts of arcProj) {
        const end = pts[pts.length - 1];
        if (!end) continue;
        const e = page(mr, end.x, end.y);
        worst = Math.max(worst, Math.hypot(e.x - hub.x, e.y - hub.y));
      }
      const boxes = [ur, mr, or];
      const boxesAgree = boxes.every(
        (r) => Math.abs(r.left - ur.left) < 0.5 && Math.abs(r.top - ur.top) < 0.5 && Math.abs(r.width - ur.width) < 0.5 && Math.abs(r.height - ur.height) < 0.5,
      );
      const storesAgree = [mid, over].every((c) => c.width === under.width && c.height === under.height);
      return {
        arcEndToHubPx: +worst.toFixed(2),
        layersAgree: drawnWith.under === drawnWith.mid && drawnWith.over === drawnWith.mid,
        frames: { ...drawnWith },
        boxesAgree,
        storesAgree,
        hub: { x: Math.round(hub.x), y: Math.round(hub.y) },
        dpr: window.devicePixelRatio,
        layoutId,
      };
    };
    const selfCheck = () => {
      const c = checkNumbers();
      if (!c) return;
      if (c.arcEndToHubPx > 0.75 || !c.layersAgree || !c.boxesAgree || !c.storesAgree) {
        if (!warned) console.error("[globe] layers out of step", c);
        warned = true;
        layout();
        staticKey = "";
      }
    };
    if (DEV) (window as unknown as { __globeCheck?: () => unknown }).__globeCheck = checkNumbers;

    /** Anything in flight besides the drift: pulses and rings, an arc drawing in, the merge. */
    const inFlight = (now: number) =>
      arcsRef.current.length > 0 ||
      hubRef.current.length > 0 ||
      (now >= merge.start && now - merge.start < MERGE_TOTAL_MS + 800);

    // The loop runs while the hero is on screen; with only the drift moving it draws at ~30 fps.
    let lastCheck = 0;
    const loop = (now: number) => {
      raf = 0;
      if (disposed) return;
      // Things a ResizeObserver does not report (a box moving without resizing, the window moving to a
      // screen with another pixel ratio): check twice a second, lay out again if anything moved.
      if (now - lastCheck > 500) {
        lastCheck = now;
        if (fingerprint() !== measured) {
          layout();
          midBox = { x0: 0, y0: 0, x1: view?.w ?? 0, y1: view?.h ?? 0 };
        }
      }
      if (inFlight(now) || now - lastDraw > 30) draw(now);
      if (!reduceRef.current && onScreen) raf = requestAnimationFrame(loop);
    };

    const kick = () => {
      if (disposed) return;
      if (reduceRef.current || !onScreen) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        draw(performance.now());
        return;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    redrawRef.current = {
      kick,
      restatic: () => {
        staticKey = "";
        kick();
      },
      relabel: () => {
        countryPick = null;
        labelPick.clear();
        staticKey = "";
        kick();
      },
    };

    if (!paletteRef.current) paletteRef.current = readPalette(under);
    layout();
    kick();

    loadGeo()
      .then((g) => {
        if (disposed) return;
        geo = g;
        pointVecs = g.points.map((p) => toVec(p.at));
        pointIndex = new Map(g.points.map((p, i) => [p.code, i]));
        dupsOf = new Map();
        for (const p of g.points) if (p.dup) dupsOf.set(p.goldenCode, [...(dupsOf.get(p.goldenCode) ?? []), p.code]);
        cull();
        geomCache.clear();
        // Names and labels now keep clear of the records too.
        countryPick = null;
        labelPick.clear();
        staticKey = "";
        kick();
      })
      .catch(() => {
        // No geography (e.g. canvas readback blocked): the globe, arcs and markers still draw.
      });

    const ro = new ResizeObserver(() => {
      layout();
      midBox = { x0: 0, y0: 0, x1: view?.w ?? 0, y1: view?.h ?? 0 };
      kick();
    });
    ro.observe(under);
    const zone = zoneRef?.current;
    if (zone) ro.observe(zone);
    for (const el of [headRef?.current, ...(keepOutRefs ?? []).map((r) => r.current)]) if (el) ro.observe(el);

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      if (!onScreen && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      kick();
    });
    io.observe(under);

    return () => {
      disposed = true;
      redrawRef.current = { kick: () => {}, restatic: () => {}, relabel: () => {} };
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      geomCache.clear();
    };
  }, [zoneRef, headRef, keepOutRefs, merge, highlightRef]);

  const layer = "absolute inset-0 block size-full";
  return (
    <div aria-hidden className={cn("pointer-events-none", className)}>
      <canvas ref={underRef} className={layer} />
      <canvas ref={midRef} className={layer} />
      <canvas ref={overRef} className={layer} />
    </div>
  );
}

/** Total length of the merge, for the counter and the replay control. */
export const MERGE_MS = MERGE_TOTAL_MS;

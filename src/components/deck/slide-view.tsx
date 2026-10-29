"use client";

import { memo } from "react";
import { STAGE_H, STAGE_W, type SlideMode } from "./primitives";
import { SLIDES, MAIN_COUNT, type SlideMeta } from "./slides-config";
import { SLIDE_COMPONENTS } from "./slides";

export function positionOf(meta: SlideMeta): string {
  return meta.appendix ? meta.label : `${meta.label} / ${MAIN_COUNT}`;
}

/** One slide at design size (1920×1080), unscaled. */
export function SlideView({
  index,
  mode,
  play = false,
  step,
  thumb,
  handoff,
  onHandoff,
}: {
  index: number;
  mode: SlideMode;
  play?: boolean;
  step?: number;
  thumb?: boolean;
  handoff?: boolean;
  onHandoff?: () => void;
}) {
  const meta = SLIDES[index];
  const C = SLIDE_COMPONENTS[meta.id];
  return (
    <C
      mode={mode}
      play={play}
      step={step ?? (meta.steps ?? 1) - 1}
      thumb={thumb}
      handoff={handoff}
      onHandoff={onHandoff}
      position={positionOf(meta)}
    />
  );
}

/** A slide scaled to a given width, static: presenter view and index thumbnails. */
export const SlideThumb = memo(function SlideThumb({ index, width, className }: { index: number; width: number; className?: string }) {
  const k = width / STAGE_W;
  return (
    <div className={className} style={{ width, height: STAGE_H * k, position: "relative", overflow: "hidden" }}>
      <div style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${k})`, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }}>
        <SlideView index={index} mode="static" thumb />
      </div>
    </div>
  );
});

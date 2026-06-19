import type { Point } from "../types";
import type { TrainingHeadSnapshot } from "./types";
import { sceneBoundsFt } from "./exclusion-generator";
import type { ExclusionZone } from "../types";

export const TRAINING_MIN_STAGE_PADDING_PX = 40;

/** Extra pixels beyond spray reach for rotation handles and arc buttons. */
const TRAINING_UI_CHROME_PX = 56;

function headCoverageReachPx(head: TrainingHeadSnapshot, pxPerFt: number): number {
  if (head.stripPattern && head.patternWidthFt != null && head.patternLengthFt != null) {
    return Math.max(head.patternWidthFt, head.patternLengthFt) * pxPerFt;
  }
  return head.radiusFeet * pxPerFt;
}

/** Padding so corner heads, arcs, and editor chrome are not clipped by the Konva stage. */
export function computeTrainingStagePaddingPx(
  sceneWidthFt: number,
  sceneHeightFt: number,
  heads: TrainingHeadSnapshot[],
  pxPerFt: number,
  minPaddingPx = TRAINING_MIN_STAGE_PADDING_PX
): number {
  const sceneWPx = sceneWidthFt * pxPerFt;
  const sceneHPx = sceneHeightFt * pxPerFt;
  let pad = minPaddingPx;

  for (const head of heads) {
    const cx = head.positionFt.x * pxPerFt;
    const cy = head.positionFt.y * pxPerFt;
    const reach = headCoverageReachPx(head, pxPerFt) + TRAINING_UI_CHROME_PX;
    pad = Math.max(pad, reach - cx);
    pad = Math.max(pad, reach - cy);
    pad = Math.max(pad, cx + reach - sceneWPx);
    pad = Math.max(pad, cy + reach - sceneHPx);
  }

  // Side-length labels render slightly outside the lawn outline.
  pad = Math.max(pad, minPaddingPx + 28);

  return Math.ceil(pad);
}

export function trainingSceneDimensionsFt(
  lawnVertices: Point[],
  exclusions: ExclusionZone[]
): { widthFt: number; heightFt: number } {
  const b = sceneBoundsFt(lawnVertices, exclusions);
  return {
    widthFt: Math.max(0, b.maxX - b.minX),
    heightFt: Math.max(0, b.maxY - b.minY),
  };
}

export function trainingStageSizePx(
  sceneWidthFt: number,
  sceneHeightFt: number,
  heads: TrainingHeadSnapshot[],
  pxPerFt: number
): { paddingPx: number; widthPx: number; heightPx: number } {
  const paddingPx = computeTrainingStagePaddingPx(
    sceneWidthFt,
    sceneHeightFt,
    heads,
    pxPerFt
  );
  return {
    paddingPx,
    widthPx: sceneWidthFt * pxPerFt + paddingPx * 2,
    heightPx: sceneHeightFt * pxPerFt + paddingPx * 2,
  };
}

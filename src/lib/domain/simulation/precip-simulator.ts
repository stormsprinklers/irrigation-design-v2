import { isPointInHeadCoverage, headStripSpec, type HeadCoverageInput } from "../placement/head-coverage";
import { stripCoverageRatio } from "@/lib/catalog/strip-pattern";
import type { Point } from "../types";
import { DEFAULT_RADIAL_CURVE, type DistributionCurve } from "./radial-curve";
import { buildPrecipGrid, samplePointsInPolygonFeet } from "./sample-grid";
import type { PrecipGrid, TrainingHeadSnapshot } from "../training/types";
import { TRAINING_PPF } from "../training/placement-adapter";

export type SimulateOptions = {
  stepFt?: number;
  curve?: DistributionCurve;
};

function baseRate(head: TrainingHeadSnapshot): number {
  if (head.precipInPerHr != null && head.precipInPerHr > 0) return head.precipInPerHr;
  if (head.gpm != null && head.gpm > 0) return head.gpm;
  return 1;
}

export function precipAtPoint(
  point: Point,
  heads: TrainingHeadSnapshot[],
  curve: DistributionCurve = DEFAULT_RADIAL_CURVE
): number {
  let total = 0;
  for (const snap of heads) {
    const coverageHead: HeadCoverageInput = {
      position: snap.positionFt,
      arcDegrees: snap.arcDegrees,
      radiusFeet: snap.radiusFeet,
      rotationDegrees: snap.rotationDegrees,
      stripPattern: snap.stripPattern,
      patternWidthFt: snap.patternWidthFt,
      patternLengthFt: snap.patternLengthFt,
    };
    if (!isPointInHeadCoverage(coverageHead, point, TRAINING_PPF)) continue;

    const strip = headStripSpec(coverageHead);
    const strength = strip
      ? curve.strengthAtRatio(
          stripCoverageRatio(point, snap.positionFt, snap.rotationDegrees, strip)
        )
      : (() => {
          const dx = point.x - snap.positionFt.x;
          const dy = point.y - snap.positionFt.y;
          const distRatio = Math.hypot(dx, dy) / Math.max(snap.radiusFeet, 0.01);
          return curve.strengthAtRatio(distRatio);
        })();
    total += strength * baseRate(snap);
  }
  return total;
}

export function simulatePrecipitation(
  vertices: Point[],
  heads: TrainingHeadSnapshot[],
  options: SimulateOptions = {}
): { grid: PrecipGrid; samplePoints: Point[]; values: number[] } {
  const stepFt = options.stepFt ?? 1.5;
  const curve = options.curve ?? DEFAULT_RADIAL_CURVE;
  const samplePoints = samplePointsInPolygonFeet(vertices, stepFt);
  const values = samplePoints.map((p) => precipAtPoint(p, heads, curve));
  const grid = buildPrecipGrid(vertices, samplePoints, values, stepFt);
  return { grid, samplePoints, values };
}

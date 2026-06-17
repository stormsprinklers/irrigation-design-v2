import { isPointInWedge } from "../placement/wedge";
import type { TrainingHeadSnapshot } from "../training/types";
import type { Point } from "../types";
import { DEFAULT_RADIAL_CURVE, type DistributionCurve } from "./radial-curve";
import { buildPrecipGrid, samplePointsInPolygonFeet } from "./sample-grid";
import type { PrecipGrid } from "../training/types";
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
    const wedgeHead = {
      position: snap.positionFt,
      arcDegrees: snap.arcDegrees,
      radiusFeet: snap.radiusFeet,
      rotationDegrees: snap.rotationDegrees,
    };
    if (!isPointInWedge(wedgeHead, point, TRAINING_PPF)) continue;

    const dx = point.x - snap.positionFt.x;
    const dy = point.y - snap.positionFt.y;
    const distRatio = Math.hypot(dx, dy) / Math.max(snap.radiusFeet, 0.01);
    const strength = curve.strengthAtRatio(distRatio);
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
  const grid = buildPrecipGrid(vertices, values, stepFt);
  return { grid, samplePoints, values };
}

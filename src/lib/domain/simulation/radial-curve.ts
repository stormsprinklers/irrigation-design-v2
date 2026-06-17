import type { TrainingHeadSnapshot } from "../training/types";
import type { Point } from "../types";

export type DistributionCurve = {
  strengthAtRatio: (distRatio: number) => number;
};

export const DEFAULT_RADIAL_CURVE: DistributionCurve = {
  strengthAtRatio(distRatio: number): number {
    if (distRatio < 0 || distRatio > 1) return 0;
    if (distRatio <= 0.2) return 0.45;
    if (distRatio <= 0.5) return 0.75;
    if (distRatio <= 0.85) return 1.0;
    return 0.8;
  },
};

export function interpolateRadialCurve(
  distRatio: number,
  bands: { maxRatio: number; strength: number }[]
): number {
  if (distRatio < 0 || distRatio > 1) return 0;
  let prevMax = 0;
  let prevStrength = bands[0]?.strength ?? 0;
  for (const band of bands) {
    if (distRatio <= band.maxRatio) {
      const span = band.maxRatio - prevMax;
      if (span <= 0) return band.strength;
      const t = (distRatio - prevMax) / span;
      return prevStrength + (band.strength - prevStrength) * t;
    }
    prevMax = band.maxRatio;
    prevStrength = band.strength;
  }
  return 0;
}

export function headStrengthAtPoint(
  head: TrainingHeadSnapshot,
  point: Point,
  curve: DistributionCurve = DEFAULT_RADIAL_CURVE
): number {
  const dx = point.x - head.positionFt.x;
  const dy = point.y - head.positionFt.y;
  const dist = Math.hypot(dx, dy);
  if (head.radiusFeet <= 0) return 0;
  const ratio = dist / head.radiusFeet;
  return curve.strengthAtRatio(ratio);
}

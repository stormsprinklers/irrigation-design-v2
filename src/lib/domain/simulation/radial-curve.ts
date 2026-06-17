import type { TrainingHeadSnapshot } from "../training/types";
import type { Point } from "../types";

export type DistributionCurve = {
  strengthAtRatio: (distRatio: number) => number;
};

export type DistributionCurveVersion = "default_taper_v1" | "legacy_bell_v0";

/** Active default — stronger near the head, weaker at throw edge (head-to-head overlap model). */
export const CURRENT_DISTRIBUTION_CURVE_VERSION: DistributionCurveVersion =
  "default_taper_v1";

/** Previous middle-heavy bell curve; kept for rescoring legacy examples. */
export const LEGACY_DISTRIBUTION_CURVE_VERSION: DistributionCurveVersion =
  "legacy_bell_v0";

const TAPER_V1_BANDS: { maxRatio: number; strength: number }[] = [
  { maxRatio: 0.2, strength: 1.0 },
  { maxRatio: 0.4, strength: 0.85 },
  { maxRatio: 0.6, strength: 0.65 },
  { maxRatio: 0.8, strength: 0.45 },
  { maxRatio: 1.0, strength: 0.25 },
];

const LEGACY_BELL_BANDS: { maxRatio: number; strength: number }[] = [
  { maxRatio: 0.2, strength: 0.45 },
  { maxRatio: 0.5, strength: 0.75 },
  { maxRatio: 0.85, strength: 1.0 },
  { maxRatio: 1.0, strength: 0.8 },
];

function stepStrengthAtRatio(
  distRatio: number,
  bands: { maxRatio: number; strength: number }[]
): number {
  if (distRatio < 0 || distRatio > 1) return 0;
  for (const band of bands) {
    if (distRatio <= band.maxRatio) return band.strength;
  }
  return 0;
}

export const DEFAULT_TAPER_V1_CURVE: DistributionCurve = {
  strengthAtRatio(distRatio: number): number {
    return stepStrengthAtRatio(distRatio, TAPER_V1_BANDS);
  },
};

export const LEGACY_BELL_V0_CURVE: DistributionCurve = {
  strengthAtRatio(distRatio: number): number {
    return stepStrengthAtRatio(distRatio, LEGACY_BELL_BANDS);
  },
};

/** @deprecated Use DEFAULT_TAPER_V1_CURVE or getDistributionCurve(). */
export const DEFAULT_RADIAL_CURVE: DistributionCurve = DEFAULT_TAPER_V1_CURVE;

const CURVE_BY_VERSION: Record<DistributionCurveVersion, DistributionCurve> = {
  default_taper_v1: DEFAULT_TAPER_V1_CURVE,
  legacy_bell_v0: LEGACY_BELL_V0_CURVE,
};

export function isDistributionCurveVersion(
  value: string | undefined
): value is DistributionCurveVersion {
  return value === "default_taper_v1" || value === "legacy_bell_v0";
}

export function getDistributionCurve(
  version?: string | null
): DistributionCurve {
  if (version && isDistributionCurveVersion(version)) {
    return CURVE_BY_VERSION[version];
  }
  return DEFAULT_TAPER_V1_CURVE;
}

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
  curve: DistributionCurve = DEFAULT_TAPER_V1_CURVE
): number {
  const dx = point.x - head.positionFt.x;
  const dy = point.y - head.positionFt.y;
  const dist = Math.hypot(dx, dy);
  if (head.radiusFeet <= 0) return 0;
  const ratio = dist / head.radiusFeet;
  return curve.strengthAtRatio(ratio);
}

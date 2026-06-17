import { pointInPolygon } from "../placement/geometry";
import { isPointInWedge } from "../placement/wedge";
import type { PrecipGrid, TrainingHeadSnapshot, UniformityScores } from "../training/types";
import { TRAINING_PPF } from "../training/placement-adapter";
import type { Point } from "../types";
import { precipAtPoint } from "./precip-simulator";
import { buildPrecipGrid, samplePointsInPolygonFeet } from "./sample-grid";
import type { DistributionCurve } from "./radial-curve";
import { DEFAULT_RADIAL_CURVE } from "./radial-curve";

export type ScoringOptions = {
  dryThreshold?: number;
  wetThreshold?: number;
  curve?: DistributionCurve;
};

function computeDuLq(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg <= 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q = Math.max(1, Math.ceil(sorted.length * 0.25));
  const lowSlice = sorted.slice(0, q);
  const lowAvg = lowSlice.reduce((a, b) => a + b, 0) / lowSlice.length;
  return lowAvg / avg;
}

function countHeadToHeadViolations(heads: TrainingHeadSnapshot[]): number {
  let violations = 0;
  for (let i = 0; i < heads.length; i++) {
    for (let j = i + 1; j < heads.length; j++) {
      const h1 = heads[i];
      const h2 = heads[j];
      const r = Math.max(h1.radiusFeet, h2.radiusFeet);
      const d = Math.hypot(
        h1.positionFt.x - h2.positionFt.x,
        h1.positionFt.y - h2.positionFt.y
      );
      if (d > r * 1.08 && d < r * 2.5) violations++;
    }
  }
  return violations;
}

function estimateOversprayPercent(vertices: Point[], heads: TrainingHeadSnapshot[]): number {
  let outsideHits = 0;
  let checked = 0;
  for (const head of heads) {
    const wedgeHead = {
      position: head.positionFt,
      arcDegrees: head.arcDegrees,
      radiusFeet: head.radiusFeet,
      rotationDegrees: head.rotationDegrees,
    };
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const angleDeg = head.rotationDegrees - head.arcDegrees / 2 + (head.arcDegrees * i) / steps;
      const angle = (angleDeg * Math.PI) / 180;
      const p = {
        x: head.positionFt.x + Math.cos(angle) * head.radiusFeet,
        y: head.positionFt.y + Math.sin(angle) * head.radiusFeet,
      };
      if (!isPointInWedge(wedgeHead, p, TRAINING_PPF)) continue;
      checked++;
      if (!pointInPolygon(p, vertices)) outsideHits++;
    }
  }
  if (checked === 0) return 0;
  return Math.round((outsideHits / checked) * 100);
}

export function scoreUniformity(
  heads: TrainingHeadSnapshot[],
  precipValues: number[],
  options: ScoringOptions = {}
): UniformityScores {
  const dryThreshold = options.dryThreshold ?? 0.4;
  const wetThreshold = options.wetThreshold ?? 1.6;

  const sampleCount = precipValues.length;
  const withPrecip = precipValues.filter((v) => v > 0);
  const coveragePercent =
    sampleCount === 0 ? 0 : Math.round((withPrecip.length / sampleCount) * 100);

  const avgPrecip =
    sampleCount === 0 ? 0 : precipValues.reduce((a, b) => a + b, 0) / sampleCount;
  const minPrecip = sampleCount === 0 ? 0 : Math.min(...precipValues);
  const maxPrecip = sampleCount === 0 ? 0 : Math.max(...precipValues);
  const duLq = Math.round(computeDuLq(precipValues) * 1000) / 1000;

  let drySpotCount = 0;
  let wetSpotCount = 0;
  if (avgPrecip > 0) {
    for (const v of precipValues) {
      if (v > 0 && v < avgPrecip * dryThreshold) drySpotCount++;
      if (v > avgPrecip * wetThreshold) wetSpotCount++;
    }
  }

  return {
    coveragePercent,
    avgPrecip: Math.round(avgPrecip * 1000) / 1000,
    minPrecip: Math.round(minPrecip * 1000) / 1000,
    maxPrecip: Math.round(maxPrecip * 1000) / 1000,
    duLq,
    drySpotCount,
    wetSpotCount,
    headToHeadViolations: countHeadToHeadViolations(heads),
    oversprayEstimatePercent: 0,
    headCount: heads.length,
    sampleCount,
  };
}

export function computeImprovementScore(
  original: UniformityScores,
  approved: UniformityScores
): number {
  return Math.round(
    (approved.duLq - original.duLq) * 40 +
      (approved.coveragePercent - original.coveragePercent) * 0.5 -
      (approved.drySpotCount - original.drySpotCount) * 2 -
      Math.max(0, approved.headCount - original.headCount) * 3
  );
}

export function evaluateDesign(
  vertices: Point[],
  heads: TrainingHeadSnapshot[],
  stepFt = 1.5,
  options: ScoringOptions = {}
): {
  scores: UniformityScores;
  grid: PrecipGrid;
  samplePoints: Point[];
  precipValues: number[];
} {
  const curve = options.curve ?? DEFAULT_RADIAL_CURVE;
  const samplePoints = samplePointsInPolygonFeet(vertices, stepFt);
  const precipValues = samplePoints.map((p) => precipAtPoint(p, heads, curve));
  const scores = scoreUniformity(heads, precipValues, options);
  scores.oversprayEstimatePercent = estimateOversprayPercent(vertices, heads);
  const grid = buildPrecipGrid(vertices, precipValues, stepFt);
  return { scores, grid, samplePoints, precipValues };
}

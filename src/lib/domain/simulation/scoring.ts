import { pointInPolygon, distanceToPolygonBoundaryFt } from "../placement/geometry";
import { headStripSpec, isPointInHeadCoverage, type HeadCoverageInput } from "../placement/head-coverage";
import { stripPatternVertices } from "@/lib/catalog/strip-pattern";
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
  /** Sample locations aligned with precipValues (feet). */
  samplePoints?: Point[];
  /** Lawn polygon vertices (feet) for edge dry-spot filtering. */
  polygonVertices?: Point[];
  /** Ignore dry spots within this distance of the polygon edge (feet). */
  drySpotEdgeMarginFt?: number;
};

/** Dry = covered sample below this fraction of mean covered precip. */
export const DEFAULT_DRY_THRESHOLD = 0.4;
/** Wet = only extreme overlap/runoff — well above normal head-to-head doubling. */
export const DEFAULT_WET_THRESHOLD = 3.5;

function computeDuLq(values: number[]): number {
  const covered = values.filter((v) => v > 0);
  if (covered.length === 0) return 0;
  const avg = covered.reduce((a, b) => a + b, 0) / covered.length;
  if (avg <= 0) return 0;
  const sorted = [...covered].sort((a, b) => a - b);
  const q = Math.max(1, Math.ceil(sorted.length * 0.25));
  const lowSlice = sorted.slice(0, q);
  const lowAvg = lowSlice.reduce((a, b) => a + b, 0) / lowSlice.length;
  return lowAvg / avg;
}

function estimateOversprayPercent(vertices: Point[], heads: TrainingHeadSnapshot[]): number {
  let outsideHits = 0;
  let checked = 0;
  for (const head of heads) {
    const coverageHead: HeadCoverageInput = {
      position: head.positionFt,
      arcDegrees: head.arcDegrees,
      radiusFeet: head.radiusFeet,
      rotationDegrees: head.rotationDegrees,
      stripPattern: head.stripPattern,
      patternWidthFt: head.patternWidthFt,
      patternLengthFt: head.patternLengthFt,
    };
    const strip = headStripSpec(coverageHead);

    if (strip) {
      const verts = stripPatternVertices(head.positionFt, head.rotationDegrees, strip);
      const edgeCount = verts.length;
      for (let i = 0; i < edgeCount; i++) {
        const a = verts[i]!;
        const b = verts[(i + 1) % edgeCount]!;
        for (let t = 0; t <= 4; t++) {
          const p = {
            x: a.x + (b.x - a.x) * (t / 4),
            y: a.y + (b.y - a.y) * (t / 4),
          };
          checked++;
          if (!pointInPolygon(p, vertices)) outsideHits++;
        }
      }
      continue;
    }

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
      if (!isPointInHeadCoverage(coverageHead, p, TRAINING_PPF)) continue;
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
  const dryThreshold = options.dryThreshold ?? DEFAULT_DRY_THRESHOLD;
  const wetThreshold = options.wetThreshold ?? DEFAULT_WET_THRESHOLD;
  const edgeMarginFt = options.drySpotEdgeMarginFt ?? 2;
  const samplePoints = options.samplePoints;
  const polygonVertices = options.polygonVertices;

  const sampleCount = precipValues.length;
  const coveredValues = precipValues.filter((v) => v > 0);
  const coveragePercent =
    sampleCount === 0 ? 0 : Math.round((coveredValues.length / sampleCount) * 100);

  const avgPrecip =
    sampleCount === 0 ? 0 : precipValues.reduce((a, b) => a + b, 0) / sampleCount;
  const avgCoveredPrecip =
    coveredValues.length === 0
      ? 0
      : coveredValues.reduce((a, b) => a + b, 0) / coveredValues.length;
  const minPrecip = sampleCount === 0 ? 0 : Math.min(...precipValues);
  const maxPrecip = sampleCount === 0 ? 0 : Math.max(...precipValues);
  const duLq = Math.round(computeDuLq(precipValues) * 1000) / 1000;

  let drySpotCount = 0;
  let wetSpotCount = 0;
  if (avgCoveredPrecip > 0) {
    const dryCutoff = avgCoveredPrecip * dryThreshold;
    const wetCutoff = avgCoveredPrecip * wetThreshold;
    for (let i = 0; i < precipValues.length; i++) {
      const v = precipValues[i]!;
      if (v > 0 && v < dryCutoff) {
        const nearEdge =
          samplePoints &&
          polygonVertices &&
          polygonVertices.length >= 3 &&
          distanceToPolygonBoundaryFt(samplePoints[i]!, polygonVertices) < edgeMarginFt;
        if (!nearEdge) drySpotCount++;
      }
      if (v > wetCutoff) wetSpotCount++;
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
    headToHeadViolations: 0,
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
      (approved.wetSpotCount - original.wetSpotCount) * 4 -
      (approved.oversprayEstimatePercent - original.oversprayEstimatePercent) * 0.3 -
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
  const scores = scoreUniformity(heads, precipValues, {
    ...options,
    samplePoints,
    polygonVertices: vertices,
  });
  scores.oversprayEstimatePercent = estimateOversprayPercent(vertices, heads);
  const grid = buildPrecipGrid(vertices, samplePoints, precipValues, stepFt);
  return { scores, grid, samplePoints, precipValues };
}

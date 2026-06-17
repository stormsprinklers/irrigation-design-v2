import { pointInPolygon, distanceToPolygonBoundaryFt } from "../placement/geometry";
import { headStripSpec, isPointInHeadCoverage, type HeadCoverageInput } from "../placement/head-coverage";
import { stripPatternVertices } from "@/lib/catalog/strip-pattern";
import type { PrecipGrid, TrainingHeadSnapshot, UniformityScores } from "../training/types";
import { TRAINING_PPF } from "../training/placement-adapter";
import type { ExclusionZone, Point } from "../types";
import { precipAtPoint } from "./precip-simulator";
import { buildPrecipGrid, samplePointsInPolygonFeet } from "./sample-grid";
import type { DistributionCurve } from "./radial-curve";
import { getDistributionCurve } from "./radial-curve";

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
  /** Adjacent no-spray zones (buildings, hardscape, etc.). */
  exclusionZones?: ExclusionZone[];
  /** Versioned radial precip distribution (see radial-curve.ts). */
  distributionCurveVersion?: string;
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

function pointInAnyExclusion(p: Point, exclusions: ExclusionZone[]): boolean {
  return exclusions.some((ex) => pointInPolygon(p, ex.vertices));
}

export type OversprayMetrics = {
  /** Spray reaching outside the lawn but not into an exclusion zone. */
  oversprayEstimatePercent: number;
  /** Spray reaching into an exclusion zone — penalized heavily in improvement score. */
  exclusionOversprayPercent: number;
};

function recordOverspraySample(
  p: Point,
  lawnVertices: Point[],
  exclusions: ExclusionZone[],
  tallies: { checked: number; outsideHits: number; exclusionHits: number }
) {
  tallies.checked++;
  if (pointInPolygon(p, lawnVertices)) return;
  if (exclusions.length > 0 && pointInAnyExclusion(p, exclusions)) {
    tallies.exclusionHits++;
  } else {
    tallies.outsideHits++;
  }
}

export function estimateOversprayMetrics(
  vertices: Point[],
  heads: TrainingHeadSnapshot[],
  exclusions: ExclusionZone[] = []
): OversprayMetrics {
  const tallies = { checked: 0, outsideHits: 0, exclusionHits: 0 };

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
          recordOverspraySample(
            {
              x: a.x + (b.x - a.x) * (t / 4),
              y: a.y + (b.y - a.y) * (t / 4),
            },
            vertices,
            exclusions,
            tallies
          );
        }
      }
      continue;
    }

    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const angleDeg = head.rotationDegrees - head.arcDegrees / 2 + (head.arcDegrees * i) / steps;
      const angle = (angleDeg * Math.PI) / 180;
      const p = {
        x: head.positionFt.x + Math.cos(angle) * head.radiusFeet,
        y: head.positionFt.y + Math.sin(angle) * head.radiusFeet,
      };
      if (!isPointInHeadCoverage(coverageHead, p, TRAINING_PPF)) continue;
      recordOverspraySample(p, vertices, exclusions, tallies);
    }
  }

  if (tallies.checked === 0) {
    return { oversprayEstimatePercent: 0, exclusionOversprayPercent: 0 };
  }

  return {
    oversprayEstimatePercent: Math.round((tallies.outsideHits / tallies.checked) * 100),
    exclusionOversprayPercent: Math.round((tallies.exclusionHits / tallies.checked) * 100),
  };
}

export function estimateOversprayPercent(vertices: Point[], heads: TrainingHeadSnapshot[]): number {
  return estimateOversprayMetrics(vertices, heads).oversprayEstimatePercent;
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
    exclusionOversprayPercent: 0,
    headCount: heads.length,
    sampleCount,
  };
}

/** Per-point weight in improvement score — exclusion overspray is penalized ~13× regular overspray. */
const OVERSPRAY_IMPROVEMENT_WEIGHT = 0.3;
const EXCLUSION_OVERSPRAY_IMPROVEMENT_WEIGHT = 4;

export function computeImprovementScore(
  original: UniformityScores,
  approved: UniformityScores
): number {
  return Math.round(
    (approved.duLq - original.duLq) * 40 +
      (approved.coveragePercent - original.coveragePercent) * 0.5 -
      (approved.drySpotCount - original.drySpotCount) * 2 -
      (approved.wetSpotCount - original.wetSpotCount) * 4 -
      (approved.oversprayEstimatePercent - original.oversprayEstimatePercent) *
        OVERSPRAY_IMPROVEMENT_WEIGHT -
      (approved.exclusionOversprayPercent - original.exclusionOversprayPercent) *
        EXCLUSION_OVERSPRAY_IMPROVEMENT_WEIGHT -
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
  const curve =
    options.curve ?? getDistributionCurve(options.distributionCurveVersion);
  const samplePoints = samplePointsInPolygonFeet(vertices, stepFt);
  const precipValues = samplePoints.map((p) => precipAtPoint(p, heads, curve));
  const scores = scoreUniformity(heads, precipValues, {
    ...options,
    samplePoints,
    polygonVertices: vertices,
  });
  const overspray = estimateOversprayMetrics(
    vertices,
    heads,
    options.exclusionZones ?? []
  );
  scores.oversprayEstimatePercent = overspray.oversprayEstimatePercent;
  scores.exclusionOversprayPercent = overspray.exclusionOversprayPercent;
  const grid = buildPrecipGrid(vertices, samplePoints, precipValues, stepFt);
  return { scores, grid, samplePoints, precipValues };
}

import type {
  ExclusionZone,
  HeadFamily,
  Point,
  SpacingPattern,
} from "../types";

export type TrainingShapeClass =
  | "rectangle"
  | "l_shape"
  | "narrow_strip"
  | "concave"
  | "front_yard"
  | "back_yard"
  | "irregular";

export const TRAINING_SHAPE_LABELS: Record<TrainingShapeClass, string> = {
  rectangle: "Rectangle",
  l_shape: "L-shape",
  narrow_strip: "Narrow strip",
  concave: "Concave notch",
  front_yard: "Front yard",
  back_yard: "Back yard",
  irregular: "Irregular",
};

export const TRAINING_SHAPE_CLASSES = Object.keys(
  TRAINING_SHAPE_LABELS
) as TrainingShapeClass[];

export type TrainingExampleStats = {
  total: number;
  byShape: Record<TrainingShapeClass, number>;
  needsRescore: number;
  trainingReady: number;
};

export type TrainingPolygonMetadata = {
  shapeClass: TrainingShapeClass;
  seed: number;
  widthFt: number;
  heightFt: number;
  areaSqFt: number;
  vertexCount: number;
  /** Rounded edge lengths in feet, one per polygon side. */
  sideLengthsFt: number[];
  hasExclusions: boolean;
  /** World rotation applied after shape construction (degrees, seeded). */
  rotationDeg: number;
};

export type TrainingHeadSnapshot = {
  id: string;
  positionFt: Point;
  radiusFeet: number;
  arcDegrees: number;
  rotationDegrees: number;
  wedgeStartDeg: number;
  wedgeEndDeg: number;
  catalogItemId: string;
  headBodyId?: string;
  nozzleModel?: string;
  gpm?: number;
  precipInPerHr?: number;
  /** Strip nozzles: rectangular W×L pattern (length = throw). */
  stripPattern?: "side" | "left_corner" | "right_corner" | "end" | "center";
  patternWidthFt?: number;
  patternLengthFt?: number;
};

export type PrecipGrid = {
  originFt: Point;
  stepFt: number;
  cols: number;
  rows: number;
  values: number[];
};

export type UniformityScores = {
  coveragePercent: number;
  avgPrecip: number;
  minPrecip: number;
  maxPrecip: number;
  duLq: number;
  drySpotCount: number;
  wetSpotCount: number;
  headToHeadViolations: number;
  oversprayEstimatePercent: number;
  /** Spray landing in adjacent exclusion zones (buildings, hardscape, etc.). */
  exclusionOversprayPercent: number;
  headCount: number;
  sampleCount: number;
};

export type TrainingEditLog = {
  added: string[];
  deleted: string[];
  moved: { id: string; from: Point; to: Point; deltaFt: number }[];
  changed: { id: string; field: string; from: unknown; to: unknown }[];
};

export type TrainingPlacementContext = {
  headPreference: HeadFamily;
  pressurePsi: number;
  pattern?: SpacingPattern;
  nozzleModel?: string;
  catalogItemIds: string[];
};

export type GeneratedTrainingPolygon = {
  verticesFt: Point[];
  metadata: TrainingPolygonMetadata;
  exclusionZonesFt: ExclusionZone[];
};

export type TrainingExamplePayload = {
  algorithmVersion: string;
  polygonVerticesFt: Point[];
  polygonMetadata: TrainingPolygonMetadata;
  exclusionZonesFt?: ExclusionZone[];
  placementContext: TrainingPlacementContext;
  algorithmOutput: TrainingHeadSnapshot[];
  approvedOutput: TrainingHeadSnapshot[];
  originalScores: UniformityScores;
  approvedScores: UniformityScores;
  originalPrecipGrid: PrecipGrid;
  approvedPrecipGrid: PrecipGrid;
  editLog?: TrainingEditLog;
  improvementScore: number;
  /** Radial precip distribution used for simulation scores. */
  distributionCurveVersion?: string;
  /** False when saved under a superseded distribution curve until re-scored. */
  validForTraining?: boolean;
  /** True when scores/grids should be recomputed with the current curve. */
  needsRescore?: boolean;
};

/** Client-submitted payload before server stamps algorithmVersion. */
export type TrainingExampleApprovalInput = Omit<TrainingExamplePayload, "algorithmVersion">;

export type TrainingExampleStatus = "IN_PROGRESS" | "APPROVED" | "DISCARDED";

export const TRAINING_DISPLAY_PX_PER_FT = 10;
export const TRAINING_PPF = 1;

/**
 * Export schema v1 — each JSONL line contains:
 * { id, organizationId, createdById, status, algorithmVersion, createdAt, approvedAt, payload }
 * payload fields: polygonVerticesFt, polygonMetadata, placementContext,
 * algorithmOutput, approvedOutput, originalScores, approvedScores,
 * originalPrecipGrid, approvedPrecipGrid, editLog, improvementScore,
 * distributionCurveVersion, validForTraining, needsRescore
 */
export const TRAINING_EXPORT_SCHEMA_VERSION = 1;

/** Slim ML export — omits precip grids and scores (recomputable via scoreLayout). */
export const TRAINING_ML_EXPORT_SCHEMA_VERSION = 2;

export const TRAINING_FEET_SCALE = {
  pointA: { x: 0, y: 0 },
  pointB: { x: 1, y: 0 },
  realWorldFeet: 1,
} as const;

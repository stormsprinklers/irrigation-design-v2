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

export type TrainingPolygonMetadata = {
  shapeClass: TrainingShapeClass;
  seed: number;
  widthFt: number;
  heightFt: number;
  areaSqFt: number;
  vertexCount: number;
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
 * originalPrecipGrid, approvedPrecipGrid, editLog, improvementScore
 */
export const TRAINING_EXPORT_SCHEMA_VERSION = 1;

export const TRAINING_FEET_SCALE = {
  pointA: { x: 0, y: 0 },
  pointB: { x: 1, y: 0 },
  realWorldFeet: 1,
} as const;

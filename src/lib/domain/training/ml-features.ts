/**
 * Canonical feature contract for placement ML training and inference.
 * Keep in sync with ml/placement_ml/features.py
 */
import type { Point } from "../types";
import type {
  TrainingHeadSnapshot,
  TrainingPlacementContext,
  TrainingShapeClass,
} from "./types";
import { TRAINING_SHAPE_CLASSES } from "./types";

export const ML_FEATURE_SPEC_VERSION = 1;

/** Max polygon vertices (padded/truncated). */
export const ML_MAX_VERTICES = 32;

/** Max baseline heads per example. */
export const ML_MAX_HEADS = 64;

/** Low-res distance-to-boundary grid side length. */
export const ML_BOUNDARY_GRID_SIZE = 16;

export const ML_HEAD_PREFERENCE_INDEX: Record<
  TrainingPlacementContext["headPreference"],
  number
> = {
  SPRAY: 0,
  ROTOR: 1,
  MP_ROTATOR: 2,
  DRIP: 3,
};

export const ML_SHAPE_CLASS_INDEX: Record<TrainingShapeClass, number> =
  Object.fromEntries(
    TRAINING_SHAPE_CLASSES.map((shape, i) => [shape, i])
  ) as Record<TrainingShapeClass, number>;

export type PolygonBbox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthFt: number;
  heightFt: number;
  centerX: number;
  centerY: number;
};

export type NormalizedPolygonFeatures = {
  /** Vertices in [0,1] bbox space, padded to ML_MAX_VERTICES with (0,0) pad. */
  verticesNorm: Point[];
  /** Per-vertex mask: 1 = real vertex, 0 = pad. */
  vertexMask: number[];
  /** Edge lengths normalized by max(width, height), padded. */
  edgeLengthsNorm: number[];
  /** Interior angles in degrees / 180, padded. */
  interiorAnglesNorm: number[];
  /** Global scalars: [areaNorm, aspectRatio, compactness, vertexCountNorm, shapeOneHot...] */
  globals: number[];
  /** Optional 16x16 distance-to-boundary samples in [0,1]. */
  boundaryGrid: number[];
};

export type NormalizedHeadFeatures = {
  id: string;
  /** Position in [0,1] bbox space. */
  positionNorm: Point;
  radiusNorm: number;
  arcNorm: number;
  rotationNorm: number;
  gpmNorm: number;
  precipNorm: number;
  catalogIndex: number;
};

export type MlFeatureInput = {
  polygonVerticesFt: Point[];
  shapeClass: TrainingShapeClass;
  baselineHeads: TrainingHeadSnapshot[];
  placementContext: TrainingPlacementContext;
  catalogVocab?: Record<string, number>;
};

export type MlFeatureTensors = {
  specVersion: typeof ML_FEATURE_SPEC_VERSION;
  bbox: PolygonBbox;
  polygon: NormalizedPolygonFeatures;
  heads: NormalizedHeadFeatures[];
  headMask: number[];
  context: {
    headPreferenceIndex: number;
    pressurePsiNorm: number;
    patternIndex: number;
    allowedCatalogIndices: number[];
  };
};

export type MlRefineRequestPayload = {
  modelVersion?: string;
  polygonVerticesFt: Point[];
  shapeClass?: TrainingShapeClass;
  placementContext: TrainingPlacementContext;
  baselineHeads: TrainingHeadSnapshot[];
  options?: {
    maxDeltaFt?: number;
    minConfidence?: number;
  };
};

export type MlRefineDiagnostics = {
  deletedIds: string[];
  addedHeads: TrainingHeadSnapshot[];
  meanConfidence: number;
  appliedDeltas: { id: string; dxFt: number; dyFt: number; deleteProb: number }[];
};

export type MlRefineResponsePayload = {
  refinedHeads: TrainingHeadSnapshot[];
  diagnostics: MlRefineDiagnostics;
};

function polygonBounds(vertices: Point[]): PolygonBbox {
  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const widthFt = Math.max(maxX - minX, 1e-6);
  const heightFt = Math.max(maxY - minY, 1e-6);
  return {
    minX,
    minY,
    maxX,
    maxY,
    widthFt,
    heightFt,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function interiorAngleDeg(prev: Point, vertex: Point, next: Point): number {
  const e1x = vertex.x - prev.x;
  const e1y = vertex.y - prev.y;
  const e2x = next.x - vertex.x;
  const e2y = next.y - vertex.y;
  const dot = e1x * e2x + e1y * e2y;
  const cross = e1x * e2y - e1y * e2x;
  return (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
}

function polygonArea(vertices: Point[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i]!.x * vertices[j]!.y - vertices[j]!.x * vertices[i]!.y;
  }
  return Math.abs(area) / 2;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToBoundary(p: Point, vertices: Point[]): number {
  let min = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    min = Math.min(min, distanceToSegment(p, a, b));
  }
  return min;
}

function pointInPolygon(point: Point, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i]!.x;
    const yi = vertices[i]!.y;
    const xj = vertices[j]!.x;
    const yj = vertices[j]!.y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function normalizePointToBbox(p: Point, bbox: PolygonBbox): Point {
  return {
    x: (p.x - bbox.minX) / bbox.widthFt,
    y: (p.y - bbox.minY) / bbox.heightFt,
  };
}

export function denormalizePointFromBbox(p: Point, bbox: PolygonBbox): Point {
  return {
    x: bbox.minX + p.x * bbox.widthFt,
    y: bbox.minY + p.y * bbox.heightFt,
  };
}

export function buildCatalogVocab(
  catalogItemIds: Iterable<string>
): Record<string, number> {
  const sorted = [...new Set(catalogItemIds)].sort();
  return Object.fromEntries(sorted.map((id, i) => [id, i + 1]));
}

export function buildMlFeatureTensors(input: MlFeatureInput): MlFeatureTensors {
  const bbox = polygonBounds(input.polygonVerticesFt);
  const scale = Math.max(bbox.widthFt, bbox.heightFt);
  const n = input.polygonVerticesFt.length;
  const vocab =
    input.catalogVocab ??
    buildCatalogVocab([
      ...input.placementContext.catalogItemIds,
      ...input.baselineHeads.map((h) => h.catalogItemId),
    ]);

  const verticesNorm: Point[] = [];
  const vertexMask: number[] = [];
  const edgeLengthsNorm: number[] = [];
  const interiorAnglesNorm: number[] = [];

  for (let i = 0; i < ML_MAX_VERTICES; i++) {
    if (i < n) {
      verticesNorm.push(
        normalizePointToBbox(input.polygonVerticesFt[i]!, bbox)
      );
      vertexMask.push(1);
    } else {
      verticesNorm.push({ x: 0, y: 0 });
      vertexMask.push(0);
    }
  }

  for (let i = 0; i < ML_MAX_VERTICES; i++) {
    if (i < n) {
      const a = input.polygonVerticesFt[i]!;
      const b = input.polygonVerticesFt[(i + 1) % n]!;
      edgeLengthsNorm.push(Math.hypot(b.x - a.x, b.y - a.y) / scale);
    } else {
      edgeLengthsNorm.push(0);
    }
  }

  for (let i = 0; i < ML_MAX_VERTICES; i++) {
    if (i < n) {
      const prev = input.polygonVerticesFt[(i - 1 + n) % n]!;
      const cur = input.polygonVerticesFt[i]!;
      const next = input.polygonVerticesFt[(i + 1) % n]!;
      interiorAnglesNorm.push(interiorAngleDeg(prev, cur, next) / 180);
    } else {
      interiorAnglesNorm.push(0);
    }
  }

  const area = polygonArea(input.polygonVerticesFt);
  const perimeter = input.polygonVerticesFt.reduce((sum, v, i) => {
    const next = input.polygonVerticesFt[(i + 1) % n]!;
    return sum + Math.hypot(next.x - v.x, next.y - v.y);
  }, 0);
  const compactness = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
  const shapeOneHot = TRAINING_SHAPE_CLASSES.map(
    (s) => (s === input.shapeClass ? 1 : 0)
  );

  const globals = [
    area / (scale * scale),
    bbox.widthFt / bbox.heightFt,
    compactness,
    n / ML_MAX_VERTICES,
    ...shapeOneHot,
  ];

  const boundaryGrid: number[] = [];
  for (let row = 0; row < ML_BOUNDARY_GRID_SIZE; row++) {
    for (let col = 0; col < ML_BOUNDARY_GRID_SIZE; col++) {
      const x = bbox.minX + ((col + 0.5) / ML_BOUNDARY_GRID_SIZE) * bbox.widthFt;
      const y = bbox.minY + ((row + 0.5) / ML_BOUNDARY_GRID_SIZE) * bbox.heightFt;
      const p = { x, y };
      if (!pointInPolygon(p, input.polygonVerticesFt)) {
        boundaryGrid.push(0);
      } else {
        boundaryGrid.push(Math.min(1, distanceToBoundary(p, input.polygonVerticesFt) / scale));
      }
    }
  }

  const heads: NormalizedHeadFeatures[] = [];
  const headMask: number[] = [];
  for (let i = 0; i < ML_MAX_HEADS; i++) {
    const head = input.baselineHeads[i];
    if (head) {
      heads.push({
        id: head.id,
        positionNorm: normalizePointToBbox(head.positionFt, bbox),
        radiusNorm: head.radiusFeet / scale,
        arcNorm: head.arcDegrees / 360,
        rotationNorm: head.rotationDegrees / 360,
        gpmNorm: (head.gpm ?? 0) / 20,
        precipNorm: (head.precipInPerHr ?? 0) / 2,
        catalogIndex: vocab[head.catalogItemId] ?? 0,
      });
      headMask.push(1);
    } else {
      heads.push({
        id: "",
        positionNorm: { x: 0, y: 0 },
        radiusNorm: 0,
        arcNorm: 0,
        rotationNorm: 0,
        gpmNorm: 0,
        precipNorm: 0,
        catalogIndex: 0,
      });
      headMask.push(0);
    }
  }

  return {
    specVersion: ML_FEATURE_SPEC_VERSION,
    bbox,
    polygon: {
      verticesNorm,
      vertexMask,
      edgeLengthsNorm,
      interiorAnglesNorm,
      globals,
      boundaryGrid,
    },
    heads,
    headMask,
    context: {
      headPreferenceIndex: ML_HEAD_PREFERENCE_INDEX[input.placementContext.headPreference],
      pressurePsiNorm: input.placementContext.pressurePsi / 100,
      patternIndex: input.placementContext.pattern === "triangular" ? 1 : 0,
      allowedCatalogIndices: input.placementContext.catalogItemIds.map(
        (id) => vocab[id] ?? 0
      ),
    },
  };
}

export function mlRefineRequestFromPlacement(input: {
  polygonVerticesFt: Point[];
  shapeClass?: TrainingShapeClass;
  placementContext: TrainingPlacementContext;
  baselineHeads: TrainingHeadSnapshot[];
  modelVersion?: string;
  options?: MlRefineRequestPayload["options"];
}): MlRefineRequestPayload {
  return {
    modelVersion: input.modelVersion,
    polygonVerticesFt: input.polygonVerticesFt,
    shapeClass: input.shapeClass,
    placementContext: input.placementContext,
    baselineHeads: input.baselineHeads,
    options: input.options,
  };
}

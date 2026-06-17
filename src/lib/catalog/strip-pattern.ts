import type { CatalogItemData } from "@/lib/domain/types";
import type { Point } from "@/lib/domain/types";
import { pointInPolygon } from "@/lib/domain/placement/geometry";

export type StripPatternKind = "side" | "left_corner" | "right_corner" | "end" | "center";

export type StripNozzleSpec = {
  stripPattern: StripPatternKind;
  patternWidthFt: number;
  patternLengthFt: number;
};

export type StripHeadGeometry = {
  position: Point;
  rotationDegrees: number;
  spec: StripNozzleSpec;
};

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getStripNozzleSpec(nozzle: CatalogItemData): StripNozzleSpec | null {
  const raw = nozzle.specs.stripPattern;
  if (typeof raw !== "string") return null;

  const stripPattern = raw as StripPatternKind;
  const patternWidthFt = num(nozzle.specs.patternWidthFt);
  let patternLengthFt = num(nozzle.specs.patternLengthFt);
  if (!patternWidthFt || patternWidthFt <= 0) return null;

  if (!patternLengthFt || patternLengthFt <= 0) {
    const chartMax = nozzle.nozzleChart?.radiusFeet?.length
      ? Math.max(...nozzle.nozzleChart.radiusFeet)
      : undefined;
    if (!chartMax || chartMax <= 0) return null;
    patternLengthFt = chartMax;
  }

  return { stripPattern, patternWidthFt, patternLengthFt };
}

export function isStripNozzle(nozzle: CatalogItemData): boolean {
  return getStripNozzleSpec(nozzle) != null;
}

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function unitVectors(rotationDegrees: number) {
  const rad = (normalizeDeg(rotationDegrees) * Math.PI) / 180;
  const forward = { x: Math.cos(rad), y: Math.sin(rad) };
  const left = { x: -forward.y, y: forward.x };
  return { forward, left };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(v: Point, s: number): Point {
  return { x: v.x * s, y: v.y * s };
}

/** Rectangle / strip footprint vertices in world feet (head at origin edge/corner per pattern). */
export function stripPatternVertices(
  position: Point,
  rotationDegrees: number,
  spec: StripNozzleSpec
): Point[] {
  const { forward, left } = unitVectors(rotationDegrees);
  const halfW = spec.patternWidthFt / 2;
  const len = spec.patternLengthFt;

  const at = (f: number, l: number) =>
    add(position, add(scale(forward, f), scale(left, l)));

  switch (spec.stripPattern) {
    case "left_corner":
      return [position, at(len, 0), at(len, -spec.patternWidthFt), at(0, -spec.patternWidthFt)];
    case "right_corner":
      return [position, at(len, 0), at(len, spec.patternWidthFt), at(0, spec.patternWidthFt)];
    case "center":
      return [
        at(-len / 2, -halfW),
        at(-len / 2, halfW),
        at(len / 2, halfW),
        at(len / 2, -halfW),
      ];
    case "side": {
      const halfLen = len / 2;
      const depth = spec.patternWidthFt;
      return [
        at(0, -halfLen),
        at(0, halfLen),
        at(depth, halfLen),
        at(depth, -halfLen),
      ];
    }
    case "end":
    default:
      return [
        at(0, -halfW),
        at(0, halfW),
        at(len, halfW),
        at(len, -halfW),
      ];
  }
}

export type StripLocalCoords = {
  forwardFt: number;
  lateralFt: number;
};

/** Map a world point into strip-local forward/lateral feet (forward = throw axis). */
export function stripLocalCoords(
  point: Point,
  position: Point,
  rotationDegrees: number
): StripLocalCoords {
  const { forward, left } = unitVectors(rotationDegrees);
  const dx = point.x - position.x;
  const dy = point.y - position.y;
  return {
    forwardFt: dx * forward.x + dy * forward.y,
    lateralFt: dx * left.x + dy * left.y,
  };
}

function inStripBounds(local: StripLocalCoords, spec: StripNozzleSpec): boolean {
  const halfW = spec.patternWidthFt / 2;
  const len = spec.patternLengthFt;

  switch (spec.stripPattern) {
    case "left_corner":
      return local.forwardFt >= 0 && local.forwardFt <= len && local.lateralFt <= 0 && local.lateralFt >= -spec.patternWidthFt;
    case "right_corner":
      return local.forwardFt >= 0 && local.forwardFt <= len && local.lateralFt >= 0 && local.lateralFt <= spec.patternWidthFt;
    case "center":
      return Math.abs(local.forwardFt) <= len / 2 && Math.abs(local.lateralFt) <= halfW;
    case "side":
      return (
        local.forwardFt >= 0 &&
        local.forwardFt <= spec.patternWidthFt &&
        Math.abs(local.lateralFt) <= len / 2
      );
    case "end":
    default:
      return local.forwardFt >= 0 && local.forwardFt <= len && Math.abs(local.lateralFt) <= halfW;
  }
}

export function isPointInStripPattern(
  point: Point,
  position: Point,
  rotationDegrees: number,
  spec: StripNozzleSpec
): boolean {
  const local = stripLocalCoords(point, position, rotationDegrees);
  if (!inStripBounds(local, spec)) return false;
  const verts = stripPatternVertices(position, rotationDegrees, spec);
  return pointInPolygon(point, verts);
}

/** Normalized distance 0 at head / pattern start, 1 at far edge (for precip falloff). */
export function stripCoverageRatio(
  point: Point,
  position: Point,
  rotationDegrees: number,
  spec: StripNozzleSpec
): number {
  const local = stripLocalCoords(point, position, rotationDegrees);
  const halfW = spec.patternWidthFt / 2;
  const len = Math.max(spec.patternLengthFt, 0.01);

  let forwardRatio = 0;
  let lateralRatio = 0;

  switch (spec.stripPattern) {
    case "left_corner":
      forwardRatio = local.forwardFt / len;
      lateralRatio = Math.abs(local.lateralFt) / spec.patternWidthFt;
      break;
    case "right_corner":
      forwardRatio = local.forwardFt / len;
      lateralRatio = Math.abs(local.lateralFt) / spec.patternWidthFt;
      break;
    case "center":
      forwardRatio = (Math.abs(local.forwardFt) + halfW) / (len / 2 + halfW);
      lateralRatio = Math.abs(local.lateralFt) / halfW;
      break;
    case "side":
      forwardRatio = local.forwardFt / spec.patternWidthFt;
      lateralRatio = Math.abs(local.lateralFt) / (len / 2);
      break;
    default:
      forwardRatio = local.forwardFt / len;
      lateralRatio = Math.abs(local.lateralFt) / halfW;
      break;
  }

  return Math.max(0, Math.min(1, Math.max(forwardRatio, lateralRatio)));
}

export function stripFieldsFromNozzle(nozzle: CatalogItemData): {
  stripPattern?: StripPatternKind;
  patternWidthFt?: number;
  patternLengthFt?: number;
} {
  const spec = getStripNozzleSpec(nozzle);
  if (!spec) {
    return { stripPattern: undefined, patternWidthFt: undefined, patternLengthFt: undefined };
  }
  return {
    stripPattern: spec.stripPattern,
    patternWidthFt: spec.patternWidthFt,
    patternLengthFt: spec.patternLengthFt,
  };
}

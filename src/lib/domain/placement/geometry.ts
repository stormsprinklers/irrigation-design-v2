import { distance, pixelsToFeet } from "../hydraulics";
import type { Point } from "../types";

export type PolygonAnalysis = {
  vertices: Point[];
  edgeLengthsFt: number[];
  interiorAnglesDeg: number[];
  isConvex: boolean;
  centroid: Point;
  orientationDeg: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

export function pointInPolygon(point: Point, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonBounds(vertices: Point[]) {
  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function normalizeAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

function interiorAngleAtVertex(
  prev: Point,
  vertex: Point,
  next: Point,
  ccw: boolean
): number {
  const e1x = vertex.x - prev.x;
  const e1y = vertex.y - prev.y;
  const e2x = next.x - vertex.x;
  const e2y = next.y - vertex.y;
  const len1 = Math.hypot(e1x, e1y);
  const len2 = Math.hypot(e2x, e2y);
  if (len1 < 1e-9 || len2 < 1e-9) return 180;

  const dot = (e1x * e2x + e1y * e2y) / (len1 * len2);
  const raw = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
  const cross = e1x * e2y - e1y * e2x;

  if (ccw) return cross >= 0 ? raw : 360 - raw;
  return cross <= 0 ? raw : 360 - raw;
}

function polygonSignedArea(vertices: Point[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

export function polygonCentroid(vertices: Point[]): Point {
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const cross = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
    area += cross;
    cx += (vertices[i].x + vertices[j].x) * cross;
    cy += (vertices[i].y + vertices[j].y) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-9) {
    const b = polygonBounds(vertices);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function isConvexVertex(interiorAngleDeg: number): boolean {
  return interiorAngleDeg <= 270;
}

export function analyzePolygon(vertices: Point[], ppf: number): PolygonAnalysis {
  const n = vertices.length;
  const edgeLengthsFt: number[] = [];
  const interiorAnglesDeg: number[] = [];
  const ccw = polygonSignedArea(vertices) > 0;

  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    edgeLengthsFt.push(pixelsToFeet(distance(curr, next), ppf));
    interiorAnglesDeg.push(interiorAngleAtVertex(prev, curr, next, ccw));
  }

  const isConvex = interiorAnglesDeg.every((a) => isConvexVertex(a));
  const bounds = polygonBounds(vertices);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const orientationDeg = width >= height ? 0 : 90;

  return {
    vertices,
    edgeLengthsFt,
    interiorAnglesDeg,
    isConvex,
    centroid: polygonCentroid(vertices),
    orientationDeg,
    bounds,
  };
}

export function pointAlongEdge(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function edgeBearingDeg(a: Point, b: Point): number {
  const rad = Math.atan2(b.y - a.y, b.x - a.x);
  return normalizeAngleDeg((rad * 180) / Math.PI);
}

export function bearingDeg(from: Point, to: Point): number {
  return edgeBearingDeg(from, to);
}

export function angleDiffDeg(a: number, b: number): number {
  let d = Math.abs(normalizeAngleDeg(a) - normalizeAngleDeg(b));
  if (d > 180) d = 360 - d;
  return d;
}

export function midpointBearingDeg(b1: number, b2: number): number {
  const n1 = normalizeAngleDeg(b1);
  const n2 = normalizeAngleDeg(b2);
  let mid = (n1 + n2) / 2;
  if (Math.abs(n1 - n2) > 180) mid = normalizeAngleDeg(mid + 180);
  return mid;
}

export function distanceFt(a: Point, b: Point, ppf: number): number {
  return pixelsToFeet(distance(a, b), ppf);
}

export function projectPointOnEdge(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
}

export function bisectorBearingDeg(prev: Point, vertex: Point, next: Point): number {
  const b1 = edgeBearingDeg(vertex, prev);
  const b2 = edgeBearingDeg(vertex, next);
  let mid = (b1 + b2) / 2;
  if (Math.abs(b1 - b2) > 180) mid = normalizeAngleDeg(mid + 180);
  return mid;
}

export function insetPointFromVertex(
  prev: Point,
  vertex: Point,
  next: Point,
  distancePx: number
): Point {
  const bisectorRad = (bisectorBearingDeg(prev, vertex, next) * Math.PI) / 180;
  return {
    x: vertex.x + Math.cos(bisectorRad) * distancePx,
    y: vertex.y + Math.sin(bisectorRad) * distancePx,
  };
}

export function perpendicularInwardBearing(
  a: Point,
  b: Point,
  centroid: Point
): number {
  const edgeMid = pointAlongEdge(a, b, 0.5);
  const edgeBearing = edgeBearingDeg(a, b);
  const perp1 = normalizeAngleDeg(edgeBearing + 90);
  const perp2 = normalizeAngleDeg(edgeBearing - 90);
  const test1 = {
    x: edgeMid.x + Math.cos((perp1 * Math.PI) / 180),
    y: edgeMid.y + Math.sin((perp1 * Math.PI) / 180),
  };
  const d1 = distance(test1, centroid);
  const test2 = {
    x: edgeMid.x + Math.cos((perp2 * Math.PI) / 180),
    y: edgeMid.y + Math.sin((perp2 * Math.PI) / 180),
  };
  const d2 = distance(test2, centroid);
  return d1 < d2 ? perp1 : perp2;
}

export function signedAreaPositive(vertices: Point[]): boolean {
  return polygonSignedArea(vertices) > 0;
}

export function detectSpacingPattern(
  interiorAnglesDeg: number[],
  override: "auto" | "square" | "triangular" | undefined
): "square" | "triangular" {
  if (override === "square") return "square";
  if (override === "triangular") return "triangular";
  if (interiorAnglesDeg.length === 3) return "triangular";
  const acuteCount = interiorAnglesDeg.filter((a) => a < 60).length;
  if (acuteCount >= 1 && interiorAnglesDeg.length <= 4) return "triangular";
  return "square";
}

export function samplePointsInPolygon(
  vertices: Point[],
  ppf: number,
  sampleSpacingFt = 2
): Point[] {
  const bounds = polygonBounds(vertices);
  const stepPx = sampleSpacingFt * ppf;
  const points: Point[] = [];
  for (let y = bounds.minY; y <= bounds.maxY; y += stepPx) {
    for (let x = bounds.minX; x <= bounds.maxX; x += stepPx) {
      const p = { x, y };
      if (pointInPolygon(p, vertices)) points.push(p);
    }
  }
  return points;
}

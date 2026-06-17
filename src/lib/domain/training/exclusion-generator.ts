import {
  pointAlongEdge,
  polygonBounds,
  polygonCentroid,
  pointInPolygon,
  projectPointOnEdge,
} from "../placement/geometry";
import type { ExclusionType, ExclusionZone, Point } from "../types";

const EXCLUSION_LABELS: Record<ExclusionType, string[]> = {
  BUILDING: ["House", "Garage", "Shed"],
  DRIVEWAY: ["Driveway", "Drive"],
  PATIO: ["Patio", "Deck"],
  FENCE: ["Fence line"],
  TREE: ["Tree canopy", "Tree"],
  SLOPE: ["Slope", "Embankment"],
  NO_OVERSPRAY: ["Walkway", "Utility area"],
};

type LawnEdge = {
  index: number;
  start: Point;
  end: Point;
  lengthFt: number;
};

function polygonSignedArea(vertices: Point[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i]!.x * vertices[j]!.y - vertices[j]!.x * vertices[i]!.y;
  }
  return area / 2;
}

function ensureCcw(vertices: Point[]): Point[] {
  return polygonSignedArea(vertices) >= 0 ? vertices : [...vertices].reverse();
}

function edgeLength(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function outwardUnitNormal(a: Point, b: Point, ccw: boolean): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: 0, y: 0 };
  return ccw
    ? { x: dy / len, y: -dx / len }
    : { x: -dy / len, y: dx / len };
}

function eligibleLawnEdges(vertices: Point[], minLengthFt: number): LawnEdge[] {
  const edges: LawnEdge[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const start = vertices[i]!;
    const end = vertices[(i + 1) % vertices.length]!;
    const lengthFt = edgeLength(start, end);
    if (lengthFt >= minLengthFt) {
      edges.push({ index: i, start, end, lengthFt });
    }
  }
  return edges;
}

function onLawnBoundary(point: Point, lawn: Point[], eps = 0.08): boolean {
  for (let i = 0; i < lawn.length; i++) {
    const a = lawn[i]!;
    const b = lawn[(i + 1) % lawn.length]!;
    const t = projectPointOnEdge(a, b, point);
    if (t < -0.02 || t > 1.02) continue;
    const proj = pointAlongEdge(a, b, Math.max(0, Math.min(1, t)));
    if (Math.hypot(point.x - proj.x, point.y - proj.y) <= eps) return true;
  }
  return false;
}

function exclusionOverlapsLawnInterior(vertices: Point[], lawn: Point[]): boolean {
  const mid = polygonCentroid(vertices);
  if (pointInPolygon(mid, lawn) && !onLawnBoundary(mid, lawn)) return true;

  for (const v of vertices) {
    if (pointInPolygon(v, lawn) && !onLawnBoundary(v, lawn)) return true;
  }
  return false;
}

function exclusionsOverlap(a: Point[], b: Point[]): boolean {
  for (const p of a) {
    if (pointInPolygon(p, b) && !onLawnBoundary(p, b)) return true;
  }
  for (const p of b) {
    if (pointInPolygon(p, a) && !onLawnBoundary(p, a)) return true;
  }
  const ca = polygonCentroid(a);
  const cb = polygonCentroid(b);
  if (pointInPolygon(ca, b) || pointInPolygon(cb, a)) return true;
  return false;
}

function buildAttachedExclusion(
  edge: LawnEdge,
  lawn: Point[],
  rng: () => number,
  depthFt: number
): Point[] | null {
  const ccw = polygonSignedArea(lawn) > 0;
  const outward = outwardUnitNormal(edge.start, edge.end, ccw);
  if (Math.hypot(outward.x, outward.y) < 1e-6) return null;

  const span = randRange(rng, 0.55, 1);
  const maxSpan = Math.min(1, Math.max(0.35, span));
  const margin = (1 - maxSpan) / 2;
  const t0 = margin + randRange(rng, 0, 0.08);
  const t1 = 1 - margin - randRange(rng, 0, 0.08);
  if (t1 - t0 < 0.25) return null;

  const a = pointAlongEdge(edge.start, edge.end, t0);
  const b = pointAlongEdge(edge.start, edge.end, t1);
  const offset = { x: outward.x * depthFt, y: outward.y * depthFt };

  return ensureCcw([
    a,
    b,
    { x: b.x + offset.x, y: b.y + offset.y },
    { x: a.x + offset.x, y: a.y + offset.y },
  ]);
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function pickExclusionType(rng: () => number): ExclusionType {
  const roll = rng();
  if (roll < 0.45) return "BUILDING";
  if (roll < 0.65) return "DRIVEWAY";
  if (roll < 0.78) return "PATIO";
  if (roll < 0.88) return "FENCE";
  if (roll < 0.95) return "TREE";
  if (roll < 0.98) return "SLOPE";
  return "NO_OVERSPRAY";
}

function exclusionName(type: ExclusionType, rng: () => number, index: number): string {
  const labels = EXCLUSION_LABELS[type];
  const base = labels[Math.floor(rng() * labels.length)] ?? "Exclusion";
  return index > 0 ? `${base} ${index + 1}` : base;
}

export function normalizeSceneToOrigin(
  lawnVertices: Point[],
  exclusions: ExclusionZone[]
): { lawnVertices: Point[]; exclusions: ExclusionZone[] } {
  const all = [...lawnVertices, ...exclusions.flatMap((z) => z.vertices)];
  if (all.length === 0) {
    return { lawnVertices, exclusions };
  }
  const b = polygonBounds(all);
  const shift = { x: -b.minX, y: -b.minY };
  return {
    lawnVertices: lawnVertices.map((v) => ({ x: v.x + shift.x, y: v.y + shift.y })),
    exclusions: exclusions.map((z) => ({
      ...z,
      vertices: z.vertices.map((v) => ({ x: v.x + shift.x, y: v.y + shift.y })),
    })),
  };
}

/** Generate 0–3 exclusion polygons that share an edge with the lawn (no interior overlap). */
export function generateAdjacentExclusions(
  lawnVertices: Point[],
  rng: () => number,
  seed: number
): ExclusionZone[] {
  const roll = rng();
  const targetCount = roll < 0.32 ? 0 : roll < 0.68 ? 1 : roll < 0.9 ? 2 : 3;

  const edges = eligibleLawnEdges(lawnVertices, 10);
  if (edges.length === 0 || targetCount === 0) return [];

  const shuffled = [...edges].sort(() => rng() - 0.5);
  const zones: ExclusionZone[] = [];

  for (const edge of shuffled) {
    if (zones.length >= targetCount) break;

    const depthFt = randRange(rng, 8, 22);
    const vertices = buildAttachedExclusion(edge, lawnVertices, rng, depthFt);
    if (!vertices) continue;
    if (exclusionOverlapsLawnInterior(vertices, lawnVertices)) continue;
    if (zones.some((z) => exclusionsOverlap(vertices, z.vertices))) continue;

    const boundaryVerts = vertices.filter((v) => onLawnBoundary(v, lawnVertices));
    if (boundaryVerts.length < 2) continue;

    const exclusionType = pickExclusionType(rng);
    zones.push({
      id: `training-excl-${seed}-${edge.index}-${zones.length}`,
      name: exclusionName(exclusionType, rng, zones.length),
      vertices,
      exclusionType,
    });
  }

  return zones;
}

export function sceneBoundsFt(lawnVertices: Point[], exclusions: ExclusionZone[]) {
  const all = [...lawnVertices, ...exclusions.flatMap((z) => z.vertices)];
  return polygonBounds(all);
}

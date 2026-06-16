import { feetToPixels } from "../hydraulics";
import type { ExclusionZone, Point, SprinklerHead } from "../types";
import { pointInPolygon } from "./geometry";

export type WedgeHead = Pick<
  SprinklerHead,
  "position" | "arcDegrees" | "radiusFeet" | "rotationDegrees"
>;

function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** Canvas convention: rotationDegrees is arc center bearing; Konva uses rotation - arc/2 for start. */
function wedgeStartDeg(head: WedgeHead): number {
  return normalizeDeg(head.rotationDegrees - head.arcDegrees / 2);
}

function wedgeEndDeg(head: WedgeHead): number {
  return normalizeDeg(wedgeStartDeg(head) + head.arcDegrees);
}

function angleInWedge(angleDeg: number, startDeg: number, endDeg: number): boolean {
  const a = normalizeDeg(angleDeg);
  const s = normalizeDeg(startDeg);
  const e = normalizeDeg(endDeg);
  if (s <= e) return a >= s && a <= e;
  return a >= s || a <= e;
}

export function isPointInWedge(head: WedgeHead, point: Point, ppf: number): boolean {
  const dx = point.x - head.position.x;
  const dy = point.y - head.position.y;
  const distPx = Math.hypot(dx, dy);
  const radiusPx = head.radiusFeet * ppf;
  if (distPx > radiusPx + 0.5) return false;

  const bearing = normalizeDeg((Math.atan2(dy, dx) * 180) / Math.PI);
  const start = wedgeStartDeg(head);
  const end = wedgeEndDeg(head);
  return angleInWedge(bearing, start, end);
}

function wedgeArcPoints(head: WedgeHead, ppf: number, segments = 12): Point[] {
  const radiusPx = head.radiusFeet * ppf;
  const start = wedgeStartDeg(head);
  const end = wedgeEndDeg(head);
  const points: Point[] = [head.position];
  const steps = Math.max(3, Math.ceil((head.arcDegrees / 360) * segments));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let angle: number;
    if (start <= end) {
      angle = start + (end - start) * t;
    } else {
      const span = 360 - start + end;
      angle = normalizeDeg(start + span * t);
    }
    const rad = (angle * Math.PI) / 180;
    points.push({
      x: head.position.x + Math.cos(rad) * radiusPx,
      y: head.position.y + Math.sin(rad) * radiusPx,
    });
  }
  return points;
}

function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const det = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(det) < 1e-9) return false;
  const t =
    ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / det;
  const u =
    ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / det;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function polygonEdges(vertices: Point[]): [Point, Point][] {
  const edges: [Point, Point][] = [];
  for (let i = 0; i < vertices.length; i++) {
    edges.push([vertices[i], vertices[(i + 1) % vertices.length]]);
  }
  return edges;
}

export function wedgeIntersectsPolygon(
  head: WedgeHead,
  polygon: Point[],
  ppf: number
): boolean {
  const wedgePts = wedgeArcPoints(head, ppf);
  const wedgeEdges: [Point, Point][] = [];
  for (let i = 0; i < wedgePts.length - 1; i++) {
    wedgeEdges.push([wedgePts[i], wedgePts[i + 1]]);
  }
  wedgeEdges.push([wedgePts[wedgePts.length - 1], wedgePts[0]]);

  for (const we of wedgeEdges) {
    for (const pe of polygonEdges(polygon)) {
      if (segmentsIntersect(we[0], we[1], pe[0], pe[1])) return true;
    }
  }

  for (const v of polygon) {
    if (isPointInWedge(head, v, ppf)) return true;
  }

  const arcMid = wedgePts[Math.floor(wedgePts.length / 2)];
  if (pointInPolygon(arcMid, polygon)) return true;

  return false;
}

export function wedgeHitsExclusion(
  head: WedgeHead,
  exclusions: ExclusionZone[],
  ppf: number
): boolean {
  return exclusions.some((ex) => wedgeIntersectsPolygon(head, ex.vertices, ppf));
}

export function findSafeRadius(
  head: WedgeHead,
  exclusions: ExclusionZone[],
  ppf: number,
  minRadiusFt: number,
  stepFt = 0.5
): number {
  let r = head.radiusFeet;
  while (r >= minRadiusFt) {
    const testHead = { ...head, radiusFeet: r };
    if (!wedgeHitsExclusion(testHead, exclusions, ppf)) return r;
    r -= stepFt;
  }
  return minRadiusFt;
}

export function overlapCountAtPoint(
  point: Point,
  heads: WedgeHead[],
  ppf: number
): number {
  return heads.filter((h) => isPointInWedge(h, point, ppf)).length;
}

export function dedupeDistancePx(radiusFeet: number, ppf: number): number {
  return feetToPixels(radiusFeet * 0.3, ppf);
}

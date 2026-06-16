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
export function wedgeStartDeg(head: WedgeHead): number {
  return normalizeDeg(head.rotationDegrees - head.arcDegrees / 2);
}

export function wedgeEndDeg(head: WedgeHead): number {
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
  return feetToPixels(radiusFeet * 0.25, ppf);
}

export type WedgeLimits = {
  arcDegreesMin: number;
  arcDegreesMax: number;
  radiusFeetMin: number;
  radiusFeetMax: number;
  fixedLeftEdge: boolean;
};

export function arcFromEdgeBearings(b1: number, b2: number): number {
  let diff = Math.abs(normalizeDeg(b1) - normalizeDeg(b2));
  if (diff > 180) diff = 360 - diff;
  return diff;
}

export function rotationFromEdgeBearings(
  b1: number,
  b2: number,
  arcDegrees: number,
  fixedLeftEdge: boolean
): number {
  const n1 = normalizeDeg(b1);
  const n2 = normalizeDeg(b2);

  if (fixedLeftEdge) {
    const forwardSpan = normalizeDeg(n2 - n1);
    const backwardSpan = normalizeDeg(n1 - n2);
    const start =
      Math.abs(forwardSpan - arcDegrees) <= Math.abs(backwardSpan - arcDegrees)
        ? n1
        : n2;
    return normalizeDeg(start + arcDegrees / 2);
  }

  let mid = (n1 + n2) / 2;
  if (Math.abs(n1 - n2) > 180) mid = normalizeDeg(mid + 180);
  return mid;
}

function wedgeScoreClear(head: WedgeHead, exclusions: ExclusionZone[], ppf: number): number {
  if (wedgeHitsExclusion(head, exclusions, ppf)) return -1;
  return head.arcDegrees * head.radiusFeet;
}

export function optimizeWedge(
  head: WedgeHead,
  targetEdgeBearings: [number, number],
  exclusions: ExclusionZone[],
  ppf: number,
  limits: WedgeLimits
): {
  radiusFeet: number;
  rotationDegrees: number;
  arcDegrees: number;
  hitExclusion: boolean;
} {
  let arcDegrees = Math.min(
    limits.arcDegreesMax,
    Math.max(limits.arcDegreesMin, head.arcDegrees)
  );
  if (arcDegrees < 1) {
    arcDegrees = Math.min(
      limits.arcDegreesMax,
      Math.max(limits.arcDegreesMin, arcFromEdgeBearings(targetEdgeBearings[0], targetEdgeBearings[1]))
    );
  }

  const rotationDegrees = rotationFromEdgeBearings(
    targetEdgeBearings[0],
    targetEdgeBearings[1],
    arcDegrees,
    limits.fixedLeftEdge
  );

  let radiusFeet = Math.min(limits.radiusFeetMax, Math.max(limits.radiusFeetMin, head.radiusFeet));
  let best: WedgeHead = { ...head, arcDegrees, rotationDegrees, radiusFeet };
  let bestScore = wedgeScoreClear(best, exclusions, ppf);

  while (radiusFeet >= limits.radiusFeetMin) {
    const candidate = { ...head, arcDegrees, rotationDegrees, radiusFeet };
    const score = wedgeScoreClear(candidate, exclusions, ppf);
    if (score >= 0) {
      return { radiusFeet, rotationDegrees, arcDegrees, hitExclusion: false };
    }
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
    radiusFeet -= 0.5;
  }

  const baseRot = rotationDegrees;
  for (let delta = -30; delta <= 30; delta += 5) {
    if (delta === 0) continue;
    const rot = normalizeDeg(baseRot + delta);
    for (let r = head.radiusFeet; r >= limits.radiusFeetMin; r -= 0.5) {
      const candidate = { ...head, arcDegrees, rotationDegrees: rot, radiusFeet: r };
      const score = wedgeScoreClear(candidate, exclusions, ppf);
      if (score >= 0) {
        return { radiusFeet: r, rotationDegrees: rot, arcDegrees, hitExclusion: false };
      }
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }

  return {
    radiusFeet: best.radiusFeet,
    rotationDegrees: best.rotationDegrees,
    arcDegrees: best.arcDegrees,
    hitExclusion: wedgeHitsExclusion(best, exclusions, ppf),
  };
}

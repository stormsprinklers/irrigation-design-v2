import { pointAlongEdge, projectPointOnEdge } from "../placement/geometry";
import { wedgeEndDeg, wedgeStartDeg } from "../placement/wedge";
import type { Point } from "../types";

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return Math.min(d, 360 - d);
}

/** Bearings (deg) parallel to each polygon edge, both directions. */
export function polygonEdgeBearings(vertices: Point[]): number[] {
  const bearings: number[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    const along = normalizeDeg((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
    bearings.push(along);
    bearings.push(normalizeDeg(along + 180));
  }
  return bearings;
}

/** Snap rotation so a wedge edge aligns with a nearby polygon edge. */
export function snapHeadRotationToPolygon(
  head: { rotationDegrees: number; arcDegrees: number },
  polygonVertices: Point[],
  thresholdDeg = 10
): number | null {
  if (polygonVertices.length < 3 || head.arcDegrees >= 359.5) return null;

  const edgeAngles = polygonEdgeBearings(polygonVertices);
  const start = wedgeStartDeg(head);
  const end = wedgeEndDeg(head);

  let bestRotation: number | null = null;
  let bestDiff = thresholdDeg + 1;

  for (const edgeAngle of edgeAngles) {
    const rotFromStart = normalizeDeg(edgeAngle + head.arcDegrees / 2);
    const startDiff = angleDiff(start, edgeAngle);
    if (startDiff < bestDiff) {
      bestDiff = startDiff;
      bestRotation = rotFromStart;
    }

    const rotFromEnd = normalizeDeg(edgeAngle - head.arcDegrees / 2);
    const endDiff = angleDiff(end, edgeAngle);
    if (endDiff < bestDiff) {
      bestDiff = endDiff;
      bestRotation = rotFromEnd;
    }
  }

  return bestDiff <= thresholdDeg ? bestRotation : null;
}

/** Snap head center to the nearest lawn corner or edge point within threshold. */
export function snapHeadPositionToPolygon(
  position: Point,
  polygonVertices: Point[],
  thresholdFt = 2
): Point {
  if (polygonVertices.length < 2) return position;

  let closestCorner: Point | null = null;
  let cornerDist = thresholdFt + 1e-9;
  for (const corner of polygonVertices) {
    const d = Math.hypot(position.x - corner.x, position.y - corner.y);
    if (d <= thresholdFt && d < cornerDist) {
      cornerDist = d;
      closestCorner = { x: corner.x, y: corner.y };
    }
  }
  if (closestCorner) return closestCorner;

  let bestEdge: Point | null = null;
  let edgeDist = thresholdFt + 1e-9;

  for (let i = 0; i < polygonVertices.length; i++) {
    const a = polygonVertices[i]!;
    const b = polygonVertices[(i + 1) % polygonVertices.length]!;
    const t = Math.max(0, Math.min(1, projectPointOnEdge(a, b, position)));
    const proj = pointAlongEdge(a, b, t);
    const d = Math.hypot(position.x - proj.x, position.y - proj.y);
    if (d <= thresholdFt && d < edgeDist) {
      edgeDist = d;
      bestEdge = { x: proj.x, y: proj.y };
    }
  }

  return bestEdge ?? position;
}

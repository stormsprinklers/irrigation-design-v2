import {
  pointAlongEdge,
  projectPointOnEdge,
} from "../placement/geometry";
import { wedgeEndDeg } from "../placement/wedge";
import type { Point } from "../types";
import type { TrainingHeadSnapshot } from "./types";

function unitVector(bearingDeg: number): Point {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

function normalizeVec(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export type PolygonEdgeMatch = {
  edgeIndex: number;
  a: Point;
  b: Point;
  t: number;
  distFt: number;
};

/** Nearest polygon edge to a head center (must be within maxDistFt). */
export function findNearestPolygonEdge(
  position: Point,
  vertices: Point[],
  maxDistFt = 3
): PolygonEdgeMatch | null {
  if (vertices.length < 2) return null;

  let best: PolygonEdgeMatch | null = null;

  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    const t = Math.max(0, Math.min(1, projectPointOnEdge(a, b, position)));
    const proj = pointAlongEdge(a, b, t);
    const distFt = Math.hypot(position.x - proj.x, position.y - proj.y);
    if (distFt <= maxDistFt && (best == null || distFt < best.distFt)) {
      best = { edgeIndex: i, a, b, t, distFt };
    }
  }

  return best;
}

type EdgeHeadGeometry = Pick<
  TrainingHeadSnapshot,
  "positionFt" | "radiusFeet" | "arcDegrees" | "rotationDegrees"
>;

/**
 * Next head center on the same polygon edge, one throw distance toward the arc end.
 * Returns null if the head is not on an edge or there is no room along the segment.
 */
export function nextHeadPositionAlongEdgeAtArcEnd(
  head: EdgeHeadGeometry,
  polygonVertices: Point[],
  maxEdgeDistFt = 3
): Point | null {
  const edge = findNearestPolygonEdge(head.positionFt, polygonVertices, maxEdgeDistFt);
  if (!edge) return null;

  const { a, b } = edge;
  const edgeVec = { x: b.x - a.x, y: b.y - a.y };
  const edgeLen = Math.hypot(edgeVec.x, edgeVec.y);
  if (edgeLen < 1e-6) return null;

  const edgeUnit = normalizeVec(edgeVec);
  const endUnit = unitVector(wedgeEndDeg(head));
  const dotForward = endUnit.x * edgeUnit.x + endUnit.y * edgeUnit.y;
  const along =
    Math.abs(dotForward) >= Math.abs(-(endUnit.x * edgeUnit.x + endUnit.y * edgeUnit.y))
      ? edgeUnit
      : { x: -edgeUnit.x, y: -edgeUnit.y };

  const stepFt = Math.max(1, head.radiusFeet);
  const candidate = {
    x: head.positionFt.x + along.x * stepFt,
    y: head.positionFt.y + along.y * stepFt,
  };

  const t = Math.max(0, Math.min(1, projectPointOnEdge(a, b, candidate)));
  const onEdge = pointAlongEdge(a, b, t);

  const movedFt = Math.hypot(
    onEdge.x - head.positionFt.x,
    onEdge.y - head.positionFt.y
  );
  if (movedFt < 0.5) return null;

  return onEdge;
}

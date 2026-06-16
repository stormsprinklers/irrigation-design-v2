import type { NozzleAdjustability } from "@/lib/catalog/adjustability";
import type { CatalogItemData } from "../types";
import { calculateNozzleHydraulics } from "../hydraulics";
import type { ExclusionZone, Point, SpacingPattern, SprinklerHead } from "../types";
import type { EdgeRun } from "./edge-spacing";
import {
  bearingDeg,
  bisectorBearingDeg,
  distanceFt,
  edgeBearingDeg,
  isReflexVertex,
  perpendicularInwardBearing,
  projectPointOnEdge,
  type PolygonAnalysis,
} from "./geometry";
import { optimizeWedge, type WedgeHead } from "./wedge";

export type HeadRole = "corner" | "edge" | "interior";

export type PlacementNode = {
  headId: string;
  position: Point;
  role: HeadRole;
  edgeIndex?: number;
};

const NEIGHBOR_MAX_FT_FACTOR = 1.25;
const ON_EDGE_PERP_FT = 2;

function headKey(p: Point): string {
  return `${Math.round(p.x * 1000)}:${Math.round(p.y * 1000)}`;
}

function findEdgeRunForHead(
  position: Point,
  edgeRuns: EdgeRun[],
  ppf: number
): EdgeRun | undefined {
  for (const run of edgeRuns) {
    const t = projectPointOnEdge(run.start, run.end, position);
    if (t < -0.01 || t > 1.01) continue;
    const onSeg = {
      x: run.start.x + (run.end.x - run.start.x) * t,
      y: run.start.y + (run.end.y - run.start.y) * t,
    };
    if (distanceFt(position, onSeg, ppf) <= ON_EDGE_PERP_FT) return run;
  }
  return undefined;
}

function effectiveRole(
  node: PlacementNode,
  head: SprinklerHead,
  edgeRuns: EdgeRun[],
  ppf: number
): { role: HeadRole; edgeIndex?: number } {
  if (node.role === "corner") return { role: "corner" };

  const run = findEdgeRunForHead(head.position, edgeRuns, ppf);
  if (run) {
    const t = projectPointOnEdge(run.start, run.end, head.position);
    if (t > 0.02 && t < 0.98) return { role: "edge", edgeIndex: run.edgeIndex };
  }

  return { role: node.role, edgeIndex: node.edgeIndex };
}

function inwardBearingForHead(
  head: SprinklerHead,
  role: HeadRole,
  edgeIndex: number | undefined,
  vertices: Point[],
  edgeRuns: EdgeRun[],
  analysis: PolygonAnalysis
): number | undefined {
  if (role === "edge" && edgeIndex !== undefined) {
    const run = edgeRuns.find((r) => r.edgeIndex === edgeIndex);
    if (run) return perpendicularInwardBearing(run.start, run.end, analysis.centroid);
  }

  if (role === "corner") {
    const vi = vertices.findIndex((v) => headKey(v) === headKey(head.position));
    if (vi < 0) return undefined;
    const interiorAngle = analysis.interiorAnglesDeg[vi];
    const toCentroid = bearingDeg(head.position, analysis.centroid);
    if (isReflexVertex(interiorAngle)) return toCentroid;

    const n = vertices.length;
    const bisector = bisectorBearingDeg(
      vertices[(vi - 1 + n) % n],
      vertices[vi],
      vertices[(vi + 1) % n]
    );
    let diff = Math.abs(bisector - toCentroid);
    if (diff > 180) diff = 360 - diff;
    return diff > 90 ? toCentroid : bisector;
  }

  return undefined;
}

export function buildPlacementGraph(
  heads: SprinklerHead[],
  vertices: Point[],
  edgeRuns: EdgeRun[],
  ppf: number
): Map<string, PlacementNode> {
  const graph = new Map<string, PlacementNode>();
  const vertexKeys = new Set(vertices.map((v) => headKey(v)));

  for (const head of heads) {
    let role: HeadRole = "interior";
    let edgeIndex: number | undefined;

    if (vertexKeys.has(headKey(head.position))) {
      role = "corner";
    } else {
      for (const run of edgeRuns) {
        const t = projectPointOnEdge(run.start, run.end, head.position);
        if (t > 0.02 && t < 0.98) {
          const onSeg = {
            x: run.start.x + (run.end.x - run.start.x) * t,
            y: run.start.y + (run.end.y - run.start.y) * t,
          };
          if (distanceFt(onSeg, head.position, ppf) <= ON_EDGE_PERP_FT) {
            role = "edge";
            edgeIndex = run.edgeIndex;
            break;
          }
        }
      }
    }

    graph.set(head.id, {
      headId: head.id,
      position: head.position,
      role,
      edgeIndex,
    });
  }

  return graph;
}

function neighborsOnEdgeRun(
  position: Point,
  run: EdgeRun,
  heads: SprinklerHead[],
  ppf: number,
  maxDistFt: number
): { left: Point | null; right: Point | null } {
  let left: { p: Point; t: number } | null = null;
  let right: { p: Point; t: number } | null = null;
  const myT = projectPointOnEdge(run.start, run.end, position);

  for (const h of heads) {
    const d = distanceFt(position, h.position, ppf);
    if (d < 0.1 || d > maxDistFt) continue;
    const t = projectPointOnEdge(run.start, run.end, h.position);
    const proj = {
      x: run.start.x + (run.end.x - run.start.x) * t,
      y: run.start.y + (run.end.y - run.start.y) * t,
    };
    if (distanceFt(h.position, proj, ppf) >= 1.0) continue;

    if (t < myT - 0.01) {
      if (!left || t > left.t) left = { p: h.position, t };
    } else if (t > myT + 0.01) {
      if (!right || t < right.t) right = { p: h.position, t };
    }
  }

  return {
    left: left?.p ?? null,
    right: right?.p ?? null,
  };
}

function nearestOnEdgeToward(
  position: Point,
  target: Point,
  heads: SprinklerHead[],
  ppf: number,
  maxDistFt: number
): Point | null {
  let best: { p: Point; d: number } | null = null;
  const want = bearingDeg(position, target);
  for (const h of heads) {
    if (headKey(h.position) === headKey(position)) continue;
    const d = distanceFt(position, h.position, ppf);
    if (d > maxDistFt) continue;
    const b = bearingDeg(position, h.position);
    let diff = Math.abs(b - want);
    if (diff > 180) diff = 360 - diff;
    if (diff < 50 && (!best || d < best.d)) best = { p: h.position, d };
  }
  return best?.p ?? null;
}

function targetBearingsForHead(
  head: SprinklerHead,
  role: HeadRole,
  edgeIndex: number | undefined,
  heads: SprinklerHead[],
  vertices: Point[],
  edgeRuns: EdgeRun[],
  spacingFt: number,
  ppf: number
): [number, number] {
  const maxDist = spacingFt * NEIGHBOR_MAX_FT_FACTOR;

  if (role === "corner") {
    const vi = vertices.findIndex((v) => headKey(v) === headKey(head.position));
    const n = vertices.length;
    const prev = vertices[(vi - 1 + n) % n];
    const next = vertices[(vi + 1) % n];
    const towardPrev = nearestOnEdgeToward(head.position, prev, heads, ppf, maxDist);
    const towardNext = nearestOnEdgeToward(head.position, next, heads, ppf, maxDist);
    return [
      bearingDeg(head.position, towardPrev ?? prev),
      bearingDeg(head.position, towardNext ?? next),
    ];
  }

  if (role === "edge" && edgeIndex !== undefined) {
    const run = edgeRuns.find((r) => r.edgeIndex === edgeIndex);
    if (run) {
      const { left, right } = neighborsOnEdgeRun(head.position, run, heads, ppf, maxDist);
      const edgeBearing = edgeBearingDeg(run.start, run.end);
      const reverseBearing = edgeBearingDeg(run.end, run.start);
      return [
        left ? bearingDeg(head.position, left) : reverseBearing,
        right ? bearingDeg(head.position, right) : edgeBearing,
      ];
    }
  }

  const sorted = heads
    .filter((h) => headKey(h.position) !== headKey(head.position))
    .map((h) => ({ h, d: distanceFt(head.position, h.position, ppf) }))
    .filter((x) => x.d <= maxDist && x.d > 0.1)
    .sort((a, b) => a.d - b.d);

  if (sorted.length >= 2) {
    return [
      bearingDeg(head.position, sorted[0].h.position),
      bearingDeg(head.position, sorted[1].h.position),
    ];
  }
  if (sorted.length === 1) {
    const b = bearingDeg(head.position, sorted[0].h.position);
    return [b, (b + 180) % 360];
  }

  return [0, 180];
}

function targetArcForRole(
  role: HeadRole,
  interiorNeighborCount: number,
  cornerInteriorAngle: number | undefined,
  adj: NozzleAdjustability
): number {
  if (role === "corner" && cornerInteriorAngle !== undefined) {
    if (isReflexVertex(cornerInteriorAngle)) {
      return Math.min(cornerInteriorAngle, adj.arcDegreesMax);
    }
    let arc = Math.min(cornerInteriorAngle, adj.arcDegreesMax);
    arc = Math.max(arc, adj.arcDegreesMin);
    if (Math.abs(cornerInteriorAngle - 90) < 15) arc = Math.min(90, adj.arcDegreesMax);
    return arc;
  }
  if (role === "edge") return Math.min(180, adj.arcDegreesMax);
  if (interiorNeighborCount >= 3) return Math.min(360, adj.arcDegreesMax);
  return Math.min(180, adj.arcDegreesMax);
}

function countNearby(position: Point, heads: SprinklerHead[], spacingFt: number, ppf: number): number {
  const maxDist = spacingFt * NEIGHBOR_MAX_FT_FACTOR;
  return heads.filter(
    (h) => headKey(h.position) !== headKey(position) && distanceFt(position, h.position, ppf) <= maxDist
  ).length;
}

export function assignArcsAndRotations(
  heads: SprinklerHead[],
  graph: Map<string, PlacementNode>,
  vertices: Point[],
  edgeRuns: EdgeRun[],
  analysis: PolygonAnalysis,
  spacingFt: number,
  ppf: number,
  adj: NozzleAdjustability,
  exclusions: ExclusionZone[]
): { heads: SprinklerHead[]; oversprayHeadIds: string[] } {
  const oversprayHeadIds: string[] = [];

  const updated = heads.map((head) => {
    const node = graph.get(head.id);
    if (!node) return head;

    const { role, edgeIndex } = effectiveRole(node, head, edgeRuns, ppf);

    const edgeBearings = targetBearingsForHead(
      head,
      role,
      edgeIndex,
      heads,
      vertices,
      edgeRuns,
      spacingFt,
      ppf
    );

    let cornerAngle: number | undefined;
    if (role === "corner") {
      const vi = vertices.findIndex((v) => headKey(v) === headKey(head.position));
      cornerAngle = analysis.interiorAnglesDeg[vi];
    }

    const arcDegrees = targetArcForRole(
      role,
      countNearby(head.position, heads, spacingFt, ppf),
      cornerAngle,
      adj
    );

    const inwardBearing = inwardBearingForHead(
      head,
      role,
      edgeIndex,
      vertices,
      edgeRuns,
      analysis
    );

    const wedgeHead: WedgeHead = {
      position: head.position,
      arcDegrees,
      radiusFeet: head.radiusFeet,
      rotationDegrees: 0,
    };

    const optimized = optimizeWedge(
      wedgeHead,
      edgeBearings,
      exclusions,
      ppf,
      {
        arcDegreesMin: adj.arcDegreesMin,
        arcDegreesMax: adj.arcDegreesMax,
        radiusFeetMin: adj.radiusFeetMin,
        radiusFeetMax: adj.radiusFeetMax,
        fixedLeftEdge: adj.fixedLeftEdge,
      },
      inwardBearing
    );

    if (optimized.hitExclusion) oversprayHeadIds.push(head.id);

    return {
      ...head,
      arcDegrees: optimized.arcDegrees,
      radiusFeet: optimized.radiusFeet,
      rotationDegrees: optimized.rotationDegrees,
    };
  });

  return { heads: updated, oversprayHeadIds };
}

export function finalizeHeadHydraulics(
  heads: SprinklerHead[],
  nozzle: CatalogItemData,
  pressurePsi: number,
  pattern: SpacingPattern
): SprinklerHead[] {
  return heads.map((head) => {
    const hyd = calculateNozzleHydraulics(nozzle, pressurePsi, head.arcDegrees, pattern);
    const gpmScale = head.arcDegrees >= 360 ? 1 : head.arcDegrees / 360;
    return {
      ...head,
      gpm: hyd.gpm * (head.arcDegrees <= 180 ? head.arcDegrees / 180 : gpmScale),
      precipInPerHr: pattern === "triangular" ? hyd.precipTriInPerHr : hyd.precipInPerHr,
    };
  });
}

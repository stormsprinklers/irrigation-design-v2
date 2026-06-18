import { pointInPolygon } from "../placement/geometry";
import type { CatalogItemData, Point, SprinklerHead } from "../types";
import type { TrainingHeadSnapshot } from "../training/types";
import { snapshotsToSprinklerHeads } from "../training/placement-adapter";

export type RefinePostprocessInput = {
  polygonVerticesFt: Point[];
  baselineHeads: TrainingHeadSnapshot[];
  refinedHeads: TrainingHeadSnapshot[];
  deletedIds: string[];
  catalog: CatalogItemData[];
  zoneId?: string;
  hydrozoneId?: string;
  minSpacingFactor?: number;
};

const DEFAULT_MIN_SPACING_FACTOR = 0.45;

function clampInsidePolygon(p: Point, vertices: Point[]): Point {
  if (pointInPolygon(p, vertices)) return p;
  let best = { ...vertices[0]! };
  let bestDist = Infinity;
  for (const v of vertices) {
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    if (d < bestDist) {
      bestDist = d;
      best = { ...v };
    }
  }
  return best;
}

function dedupeBySpacing(
  heads: TrainingHeadSnapshot[],
  vertices: Point[],
  minSpacingFt: number
): TrainingHeadSnapshot[] {
  const kept: TrainingHeadSnapshot[] = [];
  for (const head of heads) {
    const pos = clampInsidePolygon(head.positionFt, vertices);
    const adjusted = { ...head, positionFt: pos };
    const tooClose = kept.some(
      (k) =>
        Math.hypot(
          k.positionFt.x - adjusted.positionFt.x,
          k.positionFt.y - adjusted.positionFt.y
        ) < minSpacingFt
    );
    if (!tooClose) kept.push(adjusted);
  }
  return kept;
}

export function postprocessRefinedHeads(input: RefinePostprocessInput): TrainingHeadSnapshot[] {
  const {
    polygonVerticesFt,
    baselineHeads,
    refinedHeads,
    deletedIds,
    minSpacingFactor = DEFAULT_MIN_SPACING_FACTOR,
  } = input;

  const deleted = new Set(deletedIds);
  const baselineMap = new Map(baselineHeads.map((h) => [h.id, h]));

  let heads = refinedHeads.filter((h) => !deleted.has(h.id));

  const avgRadius =
    heads.reduce((s, h) => s + h.radiusFeet, 0) / Math.max(heads.length, 1);
  const minSpacingFt = avgRadius * minSpacingFactor;

  heads = dedupeBySpacing(heads, polygonVerticesFt, minSpacingFt);

  return heads.map((h) => {
    const base = baselineMap.get(h.id);
    if (!base) return { ...h, positionFt: clampInsidePolygon(h.positionFt, polygonVerticesFt) };
    return {
      ...base,
      ...h,
      positionFt: clampInsidePolygon(h.positionFt, polygonVerticesFt),
    };
  });
}

export function refinedSnapshotsToSprinklerHeads(
  snapshots: TrainingHeadSnapshot[],
  zoneId: string,
  hydrozoneId: string
): SprinklerHead[] {
  return snapshotsToSprinklerHeads(snapshots, zoneId, hydrozoneId);
}

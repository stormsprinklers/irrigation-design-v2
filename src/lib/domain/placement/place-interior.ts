import { generateId } from "@/lib/utils";
import { feetToPixels } from "../hydraulics";
import type { ExclusionZone, Point, SpacingPattern, SprinklerHead } from "../types";
import { pointInPolygon, type PolygonAnalysis } from "./geometry";
import {
  generateSquareGrid,
  generateTriangularGrid,
  gridDimensionsForBounds,
} from "./patterns";
import type { NozzleAssembly } from "./nozzle-selection";
import { dedupeDistancePx } from "./wedge";

type InteriorInput = {
  zoneId: string;
  hydrozoneId: string;
  vertices: Point[];
  analysis: PolygonAnalysis;
  assembly: NozzleAssembly;
  radiusFeet: number;
  pattern: SpacingPattern;
  exclusions: ExclusionZone[];
  ppf: number;
  existingHeads: SprinklerHead[];
  gridOrigin: Point;
};

function isInExclusion(point: Point, exclusions: ExclusionZone[]): boolean {
  return exclusions.some((ex) => pointInPolygon(point, ex.vertices));
}

function tooCloseToExisting(point: Point, heads: SprinklerHead[], minDistPx: number): boolean {
  return heads.some((h) => Math.hypot(h.position.x - point.x, h.position.y - point.y) < minDistPx);
}

export function interiorGridOrigin(vertices: Point[], orientationDeg: number): Point {
  if (vertices.length === 0) return { x: 0, y: 0 };
  const rad = (orientationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  let minLx = Infinity;
  let minLy = Infinity;
  let ox = vertices[0].x;
  let oy = vertices[0].y;

  for (const v of vertices) {
    const lx = v.x * cos + v.y * sin;
    const ly = -v.x * sin + v.y * cos;
    if (lx < minLx || (lx === minLx && ly < minLy)) {
      minLx = lx;
      minLy = ly;
      ox = v.x;
      oy = v.y;
    }
  }
  return { x: ox, y: oy };
}

export function placeInteriorHeads(input: InteriorInput): SprinklerHead[] {
  const {
    zoneId,
    hydrozoneId,
    vertices,
    analysis,
    assembly,
    radiusFeet,
    pattern,
    exclusions,
    ppf,
    existingHeads,
    gridOrigin,
  } = input;

  const heads: SprinklerHead[] = [];
  const spacingPx = feetToPixels(radiusFeet, ppf);
  const minDist = dedupeDistancePx(radiusFeet, ppf);
  const stripTolerance = 1.08;

  const widthPx = analysis.bounds.maxX - analysis.bounds.minX;
  const heightPx = analysis.bounds.maxY - analysis.bounds.minY;
  if (
    Math.min(widthPx, heightPx) / ppf <= radiusFeet * stripTolerance &&
    Math.max(widthPx, heightPx) / ppf <= radiusFeet * stripTolerance * 2
  ) {
    return heads;
  }

  const { cols, rows } = gridDimensionsForBounds(widthPx, heightPx, spacingPx, pattern);
  const gridPoints =
    pattern === "triangular"
      ? generateTriangularGrid(gridOrigin, spacingPx, cols, rows, analysis.orientationDeg)
      : generateSquareGrid(gridOrigin, spacingPx, cols, rows, analysis.orientationDeg);

  for (const gp of gridPoints) {
    if (!pointInPolygon(gp, vertices)) continue;
    if (isInExclusion(gp, exclusions)) continue;
    if (tooCloseToExisting(gp, [...existingHeads, ...heads], minDist)) continue;

    heads.push({
      id: generateId("head"),
      zoneId,
      hydrozoneId,
      position: { x: gp.x, y: gp.y },
      headBodyId: assembly.headBodyId,
      catalogItemId: assembly.nozzleId,
      arcDegrees: 360,
      radiusFeet,
      rotationDegrees: 0,
      locked: false,
    });
  }

  return heads;
}

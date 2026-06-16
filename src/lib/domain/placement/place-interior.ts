import { generateId } from "@/lib/utils";
import { feetToPixels } from "../hydraulics";
import { getNozzleAdjustability } from "@/lib/catalog/adjustability";
import { calculateNozzleHydraulics } from "../hydraulics";
import type { ExclusionZone, Point, SpacingPattern, SprinklerHead } from "../types";
import { pointInPolygon, type PolygonAnalysis } from "./geometry";
import {
  generateSquareGrid,
  generateTriangularGrid,
  gridDimensionsForBounds,
} from "./patterns";
import type { NozzleAssembly } from "./nozzle-selection";
import { dedupeDistancePx, findSafeRadius, wedgeHitsExclusion } from "./wedge";

type InteriorInput = {
  zoneId: string;
  hydrozoneId: string;
  vertices: Point[];
  analysis: PolygonAnalysis;
  assembly: NozzleAssembly;
  radiusFeet: number;
  pressurePsi: number;
  pattern: SpacingPattern;
  exclusions: ExclusionZone[];
  ppf: number;
  existingHeads: SprinklerHead[];
};

function isInExclusion(point: Point, exclusions: ExclusionZone[]): boolean {
  return exclusions.some((ex) => pointInPolygon(point, ex.vertices));
}

function tooCloseToExisting(point: Point, heads: SprinklerHead[], minDistPx: number): boolean {
  return heads.some((h) => Math.hypot(h.position.x - point.x, h.position.y - point.y) < minDistPx);
}

export function placeInteriorHeads(input: InteriorInput): SprinklerHead[] {
  const {
    zoneId,
    hydrozoneId,
    vertices,
    analysis,
    assembly,
    radiusFeet,
    pressurePsi,
    pattern,
    exclusions,
    ppf,
    existingHeads,
  } = input;

  const heads: SprinklerHead[] = [];
  const adj = getNozzleAdjustability(assembly.nozzle);
  const arcDegrees = Math.min(360, adj.arcDegreesMax);
  const spacingPx = feetToPixels(radiusFeet, ppf);
  const minDist = dedupeDistancePx(radiusFeet, ppf);

  const widthPx = analysis.bounds.maxX - analysis.bounds.minX;
  const heightPx = analysis.bounds.maxY - analysis.bounds.minY;
  const { cols, rows } = gridDimensionsForBounds(widthPx, heightPx, spacingPx, pattern);

  const origin = { x: analysis.bounds.minX, y: analysis.bounds.minY };
  const gridPoints =
    pattern === "triangular"
      ? generateTriangularGrid(origin, spacingPx, cols, rows, analysis.orientationDeg)
      : generateSquareGrid(origin, spacingPx, cols, rows, analysis.orientationDeg);

  for (const gp of gridPoints) {
    if (!pointInPolygon(gp, vertices)) continue;
    if (isInExclusion(gp, exclusions)) continue;
    if (tooCloseToExisting(gp, [...existingHeads, ...heads], minDist)) continue;

    const rotationDegrees = 0;
    const hyd = calculateNozzleHydraulics(assembly.nozzle, pressurePsi, arcDegrees, pattern);
    const safeRadius = findSafeRadius(
      { position: gp, arcDegrees, radiusFeet, rotationDegrees },
      exclusions,
      ppf,
      adj.radiusFeetMin
    );

    if (
      wedgeHitsExclusion(
        { position: gp, arcDegrees, radiusFeet: safeRadius, rotationDegrees },
        exclusions,
        ppf
      )
    ) {
      continue;
    }

    heads.push({
      id: generateId("head"),
      zoneId,
      hydrozoneId,
      position: { x: gp.x, y: gp.y },
      headBodyId: assembly.headBodyId,
      catalogItemId: assembly.nozzleId,
      arcDegrees,
      radiusFeet: safeRadius,
      rotationDegrees,
      gpm: hyd.gpm,
      precipInPerHr: pattern === "triangular" ? hyd.precipTriInPerHr : hyd.precipInPerHr,
      locked: false,
    });
  }

  return heads;
}

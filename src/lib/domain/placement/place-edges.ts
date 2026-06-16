import { generateId } from "@/lib/utils";
import { getNozzleAdjustability } from "@/lib/catalog/adjustability";
import { calculateNozzleHydraulics } from "../hydraulics";
import type { ExclusionZone, Point, SpacingPattern, SprinklerHead } from "../types";
import {
  perpendicularInwardBearing,
  pointAlongEdge,
  type PolygonAnalysis,
} from "./geometry";
import type { NozzleAssembly } from "./nozzle-selection";
import { dedupeDistancePx, findSafeRadius, wedgeHitsExclusion } from "./wedge";

type EdgeInput = {
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

function tooCloseToExisting(point: Point, heads: SprinklerHead[], minDistPx: number): boolean {
  return heads.some((h) => Math.hypot(h.position.x - point.x, h.position.y - point.y) < minDistPx);
}

export function placeEdgeHeads(input: EdgeInput): SprinklerHead[] {
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
  const n = vertices.length;
  const adj = getNozzleAdjustability(assembly.nozzle);
  const arcDegrees = Math.min(180, adj.arcDegreesMax);
  const minDist = dedupeDistancePx(radiusFeet, ppf);
  const tolerance = 1.08;

  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const edgeLenFt = analysis.edgeLengthsFt[i];
    if (edgeLenFt <= radiusFeet * tolerance) continue;

    const numSpans = Math.max(1, Math.round(edgeLenFt / radiusFeet));

    for (let k = 1; k < numSpans; k++) {
      const t = k / numSpans;
      const position = pointAlongEdge(a, b, t);
      if (tooCloseToExisting(position, [...existingHeads, ...heads], minDist)) continue;

      const sprayBearing = perpendicularInwardBearing(a, b, analysis.centroid);
      const rotationDegrees = sprayBearing;

      const hyd = calculateNozzleHydraulics(assembly.nozzle, pressurePsi, arcDegrees, pattern);
      const safeRadius = findSafeRadius(
        { position, arcDegrees, radiusFeet, rotationDegrees },
        exclusions,
        ppf,
        adj.radiusFeetMin
      );

      if (
        wedgeHitsExclusion(
          { position, arcDegrees, radiusFeet: safeRadius, rotationDegrees },
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
        position,
        headBodyId: assembly.headBodyId,
        catalogItemId: assembly.nozzleId,
        arcDegrees,
        radiusFeet: safeRadius,
        rotationDegrees,
        gpm: hyd.gpm * (arcDegrees / 180),
        precipInPerHr: pattern === "triangular" ? hyd.precipTriInPerHr : hyd.precipInPerHr,
        locked: false,
      });
    }
  }

  return heads;
}

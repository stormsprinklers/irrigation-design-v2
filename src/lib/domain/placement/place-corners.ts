import { generateId } from "@/lib/utils";
import { getNozzleAdjustability } from "@/lib/catalog/adjustability";
import { calculateNozzleHydraulics } from "../hydraulics";
import type { Point, SpacingPattern, SprinklerHead } from "../types";
import {
  bisectorBearingDeg,
  type PolygonAnalysis,
} from "./geometry";
import type { NozzleAssembly } from "./nozzle-selection";
import { findSafeRadius, wedgeHitsExclusion } from "./wedge";
import type { ExclusionZone } from "../types";

type CornerInput = {
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
};

export function placeCornerHeads(input: CornerInput): SprinklerHead[] {
  const {
    zoneId,
    hydrozoneId,
    vertices,
    analysis,
    assembly,
    radiusFeet,
    pressurePsi,
    exclusions,
    ppf,
  } = input;
  const heads: SprinklerHead[] = [];
  const n = vertices.length;
  const adj = getNozzleAdjustability(assembly.nozzle);

  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const vertex = vertices[i];
    const next = vertices[(i + 1) % n];
    const interiorAngle = analysis.interiorAnglesDeg[i];

    if (interiorAngle > 270) continue;

    let arcDegrees = Math.min(interiorAngle, adj.arcDegreesMax);
    arcDegrees = Math.max(arcDegrees, adj.arcDegreesMin);
    if (Math.abs(interiorAngle - 90) < 15) arcDegrees = Math.min(90, adj.arcDegreesMax);

    let rotationDegrees = bisectorBearingDeg(prev, vertex, next);
    if (adj.fixedLeftEdge) {
      rotationDegrees = (edgeBearingFromVertex(vertex, next) + arcDegrees / 2) % 360;
    }

    const hyd = calculateNozzleHydraulics(assembly.nozzle, pressurePsi, arcDegrees, input.pattern);
    const safeRadius = findSafeRadius(
      { position: vertex, arcDegrees, radiusFeet, rotationDegrees },
      exclusions,
      ppf,
      adj.radiusFeetMin
    );

    if (
      wedgeHitsExclusion(
        { position: vertex, arcDegrees, radiusFeet: safeRadius, rotationDegrees },
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
      position: vertex,
      headBodyId: assembly.headBodyId,
      catalogItemId: assembly.nozzleId,
      arcDegrees,
      radiusFeet: safeRadius,
      rotationDegrees,
      gpm: hyd.gpm,
      precipInPerHr:
        input.pattern === "triangular" ? hyd.precipTriInPerHr : hyd.precipInPerHr,
      locked: false,
    });
  }

  return heads;
}

function edgeBearingFromVertex(vertex: Point, next: Point): number {
  const rad = Math.atan2(next.y - vertex.y, next.x - vertex.x);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

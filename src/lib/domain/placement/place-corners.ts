import { generateId } from "@/lib/utils";
import type { Point, SprinklerHead } from "../types";
import type { NozzleAssembly } from "./nozzle-selection";
import type { PolygonAnalysis } from "./geometry";

type CornerInput = {
  zoneId: string;
  hydrozoneId: string;
  vertices: Point[];
  analysis: PolygonAnalysis;
  assembly: NozzleAssembly;
  radiusFeet: number;
};

export function placeCornerHeads(input: CornerInput): SprinklerHead[] {
  const { zoneId, hydrozoneId, vertices, analysis, assembly, radiusFeet } = input;
  const heads: SprinklerHead[] = [];
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const interiorAngle = analysis.interiorAnglesDeg[i];
    if (interiorAngle > 270) continue;

    heads.push({
      id: generateId("head"),
      zoneId,
      hydrozoneId,
      position: vertices[i],
      headBodyId: assembly.headBodyId,
      catalogItemId: assembly.nozzleId,
      arcDegrees: 90,
      radiusFeet,
      rotationDegrees: 0,
      locked: false,
    });
  }

  return heads;
}

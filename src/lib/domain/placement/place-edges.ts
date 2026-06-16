import { generateId } from "@/lib/utils";
import type { SprinklerHead } from "../types";
import { pointAlongEdge } from "./geometry";
import type { EdgeRun } from "./edge-spacing";
import type { NozzleAssembly } from "./nozzle-selection";

type EdgeInput = {
  zoneId: string;
  hydrozoneId: string;
  edgeRuns: EdgeRun[];
  assembly: NozzleAssembly;
  radiusFeet: number;
};

export function placeEdgeHeads(input: EdgeInput): SprinklerHead[] {
  const { zoneId, hydrozoneId, edgeRuns, assembly, radiusFeet } = input;
  const heads: SprinklerHead[] = [];
  const tolerance = 1.08;

  for (const run of edgeRuns) {
    if (run.lengthFt <= radiusFeet * tolerance) continue;

    for (const t of run.interiorTs) {
      const position = pointAlongEdge(run.start, run.end, t);
      heads.push({
        id: generateId("head"),
        zoneId,
        hydrozoneId,
        position,
        headBodyId: assembly.headBodyId,
        catalogItemId: assembly.nozzleId,
        arcDegrees: 180,
        radiusFeet,
        rotationDegrees: 0,
        locked: false,
      });
    }
  }

  return heads;
}

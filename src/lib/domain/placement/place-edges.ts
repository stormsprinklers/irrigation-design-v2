import { generateId } from "@/lib/utils";
import { distance, feetToPixels } from "../hydraulics";
import type { SprinklerHead } from "../types";
import { pointAlongEdge } from "./geometry";
import type { EdgeRun } from "./edge-spacing";
import type { NozzleAssembly } from "./nozzle-selection";
import { dedupeDistancePx } from "./wedge";

type EdgeInput = {
  zoneId: string;
  hydrozoneId: string;
  edgeRuns: EdgeRun[];
  assembly: NozzleAssembly;
  radiusFeet: number;
  ppf: number;
};

export function placeEdgeHeads(input: EdgeInput): SprinklerHead[] {
  const { zoneId, hydrozoneId, edgeRuns, assembly, radiusFeet, ppf } = input;
  const heads: SprinklerHead[] = [];
  const tolerance = 1.08;
  const minCornerDistPx = Math.max(dedupeDistancePx(radiusFeet, ppf), feetToPixels(radiusFeet * 0.5, ppf));

  for (const run of edgeRuns) {
    if (run.lengthFt <= radiusFeet * tolerance) continue;

    for (const t of run.interiorTs) {
      const position = pointAlongEdge(run.start, run.end, t);
      const distStart = distance(position, run.start);
      const distEnd = distance(position, run.end);
      if (distStart < minCornerDistPx || distEnd < minCornerDistPx) continue;

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

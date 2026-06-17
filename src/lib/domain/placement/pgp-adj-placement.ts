import { getNozzleAdjustability } from "@/lib/catalog/adjustability";
import { calculateNozzleHydraulics } from "../hydraulics";
import type { CatalogItemData, SpacingPattern, SprinklerHead } from "../types";
import type { PolygonAnalysis } from "./geometry";
import { finalizeHeadHydraulics } from "./assign-arcs";
import { computeTargetSpacingFt, type NozzleAssembly } from "./nozzle-selection";

export const PGP_ADJ_HEAD_BODY_ID = "head_hunter_pgp_adj_4";

const PGP_ADJ_BLUE_NOZZLE_IDS: Record<number, string> = {
  1.5: "noz_pgp_adj_blue_1_5",
  3: "noz_pgp_adj_blue_3_0",
  5: "noz_pgp_adj_blue_5_0",
  6: "noz_pgp_adj_blue_6_0",
};

/** MPR nozzle size bucket from installed arc (90° → 1.5, 180° → 3.0, 270° → 5.0, 360° → 6.0). */
export function pgpAdjNozzleSizeForArc(arcDegrees: number): number {
  const arc = Math.round(arcDegrees);
  if (arc >= 315) return 6;
  if (arc >= 225) return 5;
  if (arc >= 135) return 3;
  return 1.5;
}

export function findPgpAdjNozzle(
  catalog: CatalogItemData[],
  nozzleSize: number
): CatalogItemData | null {
  const id = PGP_ADJ_BLUE_NOZZLE_IDS[nozzleSize];
  if (id) {
    const byId = catalog.find((c) => c.id === id);
    if (byId) return byId;
  }
  return (
    catalog.find(
      (c) =>
        c.specs.nozzleFamily === "pgp_adj_blue" && c.specs.nozzleSize === nozzleSize
    ) ?? null
  );
}

export function isPgpAdjAssembly(assembly: NozzleAssembly): boolean {
  return assembly.headBodyId === PGP_ADJ_HEAD_BODY_ID;
}

export function selectPgpAdjAssembly(
  catalog: CatalogItemData[],
  analysis: PolygonAnalysis,
  pressurePsi: number
): NozzleAssembly | null {
  const headBody = catalog.find((c) => c.id === PGP_ADJ_HEAD_BODY_ID);
  const nozzle = findPgpAdjNozzle(catalog, 3);
  if (!headBody || !nozzle) return null;

  const adj = getNozzleAdjustability(nozzle);
  const targetSpacing = computeTargetSpacingFt(analysis);
  const radiusFeet = Math.min(
    adj.radiusFeetMax,
    Math.max(adj.radiusFeetMin, targetSpacing)
  );
  const hyd = calculateNozzleHydraulics(nozzle, pressurePsi, 180);

  return {
    headBodyId: headBody.id,
    nozzleId: nozzle.id,
    nozzle,
    headBody,
    radiusFeet,
    gpm: hyd.gpm,
    precipInPerHr: hyd.precipInPerHr,
    precipTriInPerHr: hyd.precipTriInPerHr,
    nozzleFamily: "pgp_adj_blue",
  };
}

export function assignPgpAdjNozzlesToHeads(
  catalog: CatalogItemData[],
  heads: SprinklerHead[],
  pressurePsi: number,
  pattern: SpacingPattern
): SprinklerHead[] {
  return heads.map((head) => {
    const nozzleSize = pgpAdjNozzleSizeForArc(head.arcDegrees);
    const nozzle = findPgpAdjNozzle(catalog, nozzleSize);
    if (!nozzle) {
      return { ...head, headBodyId: PGP_ADJ_HEAD_BODY_ID };
    }

    const withNozzle: SprinklerHead = {
      ...head,
      headBodyId: PGP_ADJ_HEAD_BODY_ID,
      catalogItemId: nozzle.id,
    };

    return finalizeHeadHydraulics([withNozzle], nozzle, pressurePsi, pattern)[0]!;
  });
}

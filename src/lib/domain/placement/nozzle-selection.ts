import { getNozzlesForHead } from "@/lib/catalog/compat";
import { getNozzleAdjustability } from "@/lib/catalog/adjustability";
import { calculateNozzleHydraulics } from "../hydraulics";
import type { CatalogItemData, HeadFamily } from "../types";
import type { PolygonAnalysis } from "./geometry";
import { resolveHydrozoneSpacing } from "./edge-spacing";

export type NozzleAssembly = {
  headBodyId: string;
  nozzleId: string;
  nozzle: CatalogItemData;
  headBody: CatalogItemData;
  radiusFeet: number;
  gpm: number;
  precipInPerHr?: number;
  precipTriInPerHr?: number;
  nozzleFamily: string;
};

const HEAD_PREFERENCE_BODIES: Record<HeadFamily, string[]> = {
  SPRAY: ["head_rb_1804", "head_rb_1806", "head_hunter_pros_04", "head_hunter_pros_prs40_04"],
  ROTOR: ["head_hunter_pgp_ultra_4", "head_rb_3504", "head_rb_5004"],
  MP_ROTATOR: ["head_hunter_pros_prs40_04", "head_hunter_pros_04"],
  DRIP: ["head_rb_1804"],
};

function nozzleFamilyOf(nozzle: CatalogItemData): string {
  const family = nozzle.specs.nozzleFamily;
  return typeof family === "string" ? family : nozzle.category;
}

function candidateHeadBodies(catalog: CatalogItemData[], preference: HeadFamily): CatalogItemData[] {
  const ids = HEAD_PREFERENCE_BODIES[preference] ?? HEAD_PREFERENCE_BODIES.SPRAY;
  const found = ids.map((id) => catalog.find((c) => c.id === id)).filter(Boolean) as CatalogItemData[];
  if (found.length > 0) return found;
  return catalog.filter(
    (c) =>
      c.category === "SPRAY_BODY" ||
      c.category === "ROTOR_BODY" ||
      c.specs.itemRole === "body"
  );
}

export function computeTargetSpacingFt(analysis: PolygonAnalysis): number {
  const lengths = analysis.edgeLengthsFt.filter((l) => l > 0);
  if (lengths.length === 0) return 15;
  const maxEdge = Math.max(...lengths);
  const medianEdge =
    lengths.slice().sort((a, b) => a - b)[Math.floor(lengths.length / 2)] ?? maxEdge;
  const target = Math.min(maxEdge, medianEdge * 1.5);
  return Math.max(6, target);
}

export function selectNozzleAssembly(
  catalog: CatalogItemData[],
  preference: HeadFamily,
  analysis: PolygonAnalysis,
  pressurePsi: number
): NozzleAssembly | null {
  if (preference === "DRIP") return null;

  const targetSpacing = computeTargetSpacingFt(analysis);
  const headBodies = candidateHeadBodies(catalog, preference);
  let best: { score: number; assembly: NozzleAssembly } | null = null;

  for (const headBody of headBodies) {
    const nozzles = getNozzlesForHead(catalog, headBody.id);
    for (const nozzle of nozzles) {
      const adj = getNozzleAdjustability(nozzle);
      if (adj.radiusFeetMax < targetSpacing * 0.5) continue;
      if (adj.radiusFeetMin > targetSpacing * 1.2) continue;

      const radiusFeet = Math.min(
        adj.radiusFeetMax,
        Math.max(adj.radiusFeetMin, targetSpacing)
      );
      const hyd = calculateNozzleHydraulics(nozzle, pressurePsi, adj.arcDegreesDefault);
      const spacingError = Math.abs(radiusFeet - targetSpacing) / targetSpacing;
      const adjustableBonus = adj.radiusAdjustable ? 0.1 : 0;
      const score = spacingError - adjustableBonus;

      const assembly: NozzleAssembly = {
        headBodyId: headBody.id,
        nozzleId: nozzle.id,
        nozzle,
        headBody,
        radiusFeet,
        gpm: hyd.gpm,
        precipInPerHr: hyd.precipInPerHr,
        precipTriInPerHr: hyd.precipTriInPerHr,
        nozzleFamily: nozzleFamilyOf(nozzle),
      };

      if (!best || score < best.score) {
        best = { score, assembly };
      }
    }
  }

  return best?.assembly ?? null;
}

export function refineSpacingRadius(
  analysis: PolygonAnalysis,
  assembly: NozzleAssembly
): number {
  const adj = getNozzleAdjustability(assembly.nozzle);
  const { radiusFeet } = resolveHydrozoneSpacing(analysis, adj, assembly.radiusFeet);
  return radiusFeet;
}

import { buildMaterialList, calculateQuoteTotals } from "../materials";
import { recommendRuntimes } from "../runtime";
import { validateDesign } from "../validation";
import type {
  CatalogItemData,
  DesignDocument,
  PricingProfileData,
  ValidationIssue,
} from "../types";

export type CustomerProposal = {
  projectName: string;
  zones: Array<{ name: string; runtimeMinutes: number; note: string }>;
  productSummary: string[];
  wateringGuidance: string[];
  scopeNotes: string[];
};

export type InstallerSchematic = {
  zones: Array<{
    name: string;
    totalGpm: number;
    criticalPressurePsi: number;
    heads: Array<{ model: string; arc: number; radius: number; gpm: number }>;
    pipes: Array<{ material: string; diameter: number; length: number; frictionPsi: number }>;
  }>;
  materialList: ReturnType<typeof buildMaterialList>;
  totals: ReturnType<typeof calculateQuoteTotals>;
  validationIssues: ValidationIssue[];
};

export function buildCustomerProposal(
  doc: DesignDocument,
  projectName: string,
  catalog: CatalogItemData[]
): CustomerProposal {
  const runtimes = recommendRuntimes(doc.zones, doc);
  const catalogMap = new Map(catalog.map((c) => [c.id, c]));

  const productSet = new Set<string>();
  for (const head of doc.heads) {
    const item = catalogMap.get(head.catalogItemId);
    if (item) productSet.add(`${item.manufacturer} ${item.model}`);
  }

  return {
    projectName,
    zones: doc.zones.map((z) => ({
      name: z.name,
      runtimeMinutes: runtimes[z.id]?.minutes ?? z.runtimeMinutes ?? 25,
      note: runtimes[z.id]?.note ?? "",
    })),
    productSummary: [...productSet],
    wateringGuidance: [
      "Water early morning to reduce evaporation",
      "Adjust runtimes seasonally based on weather",
      "Isolate one zone at a time when testing coverage",
    ],
    scopeNotes: [
      `${doc.zones.length} irrigation zone(s)`,
      `${doc.heads.length} sprinkler head(s)`,
      `${doc.hydrozones.length} hydrozone area(s)`,
    ],
  };
}

export function buildInstallerSchematic(
  doc: DesignDocument,
  catalog: CatalogItemData[],
  pricing: PricingProfileData,
  hydraulicsFn: (zoneId: string) => { totalGpm: number; criticalHeadPressurePsi: number }
): InstallerSchematic {
  const catalogMap = new Map(catalog.map((c) => [c.id, c]));
  const materialList = buildMaterialList(doc, catalog, pricing);
  const totals = calculateQuoteTotals(doc, materialList, pricing);

  return {
    zones: doc.zones.map((zone) => {
      const hyd = hydraulicsFn(zone.id);
      return {
        name: zone.name,
        totalGpm: hyd.totalGpm,
        criticalPressurePsi: hyd.criticalHeadPressurePsi,
        heads: doc.heads
          .filter((h) => h.zoneId === zone.id)
          .map((h) => {
            const item = catalogMap.get(h.catalogItemId);
            return {
              model: item ? `${item.manufacturer} ${item.model}` : h.catalogItemId,
              arc: h.arcDegrees,
              radius: h.radiusFeet,
              gpm: h.gpm ?? 0,
            };
          }),
        pipes: doc.pipes
          .filter((p) => p.zoneId === zone.id)
          .map((p) => ({
            material: p.material,
            diameter: p.diameterInches,
            length: p.lengthFeet ?? 0,
            frictionPsi: p.frictionLossPsi ?? 0,
          })),
      };
    }),
    materialList,
    totals,
    validationIssues: validateDesign(doc, catalog),
  };
}

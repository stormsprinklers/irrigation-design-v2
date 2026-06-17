import type { CatalogSeedItem, NozzleChart } from "./chart";

export type BodyCategory = "SPRAY_BODY" | "ROTOR_BODY";
export type MpArcBand = "90_210" | "210_270" | "360";

/** Hunter MP Rotator throw ranges (design guide LIT-461). */
export const MP_RADIUS_FT: Record<string, { min: number; max: number }> = {
  "MP-800SR": { min: 6, max: 12 },
  "MP-1000": { min: 8, max: 15 },
  "MP-2000": { min: 13, max: 21 },
  "MP-3000": { min: 22, max: 30 },
  "MP-3500": { min: 31, max: 35 },
};

/** Rain Bird R-VAN throw ranges (tech spec). */
export const RVAN_RADIUS_FT: Record<string, { min: number; max: number }> = {
  "R-VAN14": { min: 8, max: 14 },
  "R-VAN18": { min: 13, max: 18 },
  "R-VAN24": { min: 17, max: 24 },
  "R-VAN14-360": { min: 8, max: 14 },
  "R-VAN18-360": { min: 13, max: 18 },
  "R-VAN24-360": { min: 17, max: 24 },
};

export const MP_ARC_BANDS: Record<
  MpArcBand,
  { min: number; max: number; default: number; fixedLeftEdge: boolean }
> = {
  "90_210": { min: 90, max: 210, default: 180, fixedLeftEdge: true },
  "210_270": { min: 210, max: 270, default: 210, fixedLeftEdge: true },
  "360": { min: 360, max: 360, default: 360, fixedLeftEdge: false },
};

export function defaultMinRadius(maxRadius: number): number {
  return Math.round(maxRadius * 0.75 * 100) / 100;
}

export function sprayNozzleSpecs(
  base: Record<string, unknown>,
  opts: {
    arcMin: number;
    arcMax: number;
    arcDefault: number;
    radiusMin: number;
    radiusMax: number;
    arcAdjustable: boolean;
    radiusAdjustable: boolean;
    fixedLeftEdge?: boolean;
    mpArcBand?: MpArcBand;
  }
): Record<string, unknown> {
  return {
    ...base,
    itemRole: "nozzle",
    compatibleBodyCategories: ["SPRAY_BODY"] as BodyCategory[],
    arcDegreesMin: opts.arcMin,
    arcDegreesMax: opts.arcMax,
    arcDegreesDefault: opts.arcDefault,
    radiusFeetMin: opts.radiusMin,
    radiusFeetMax: opts.radiusMax,
    arcAdjustable: opts.arcAdjustable,
    radiusAdjustable: opts.radiusAdjustable,
    rotationAdjustable: true,
    fixedLeftEdge: opts.fixedLeftEdge ?? false,
    ...(opts.mpArcBand ? { mpArcBand: opts.mpArcBand } : {}),
  };
}

export function rotorNozzleSpecs(base: Record<string, unknown>): Record<string, unknown> {
  return {
    ...base,
    itemRole: "nozzle",
    compatibleBodyCategories: ["ROTOR_BODY"] as BodyCategory[],
    arcDegreesMin: 40,
    arcDegreesMax: 360,
    arcDegreesDefault: 180,
    arcAdjustable: true,
    radiusAdjustable: false,
    rotationAdjustable: true,
  };
}

export function enrichNozzleItem(item: CatalogSeedItem): CatalogSeedItem {
  if (item.specs.itemRole === "body") return item;

  const isNozzle =
    item.category === "SPRAY" ||
    item.category === "ROTOR" ||
    item.category === "MP_ROTATOR" ||
    item.specs.itemRole === "nozzle" ||
    Boolean(item.nozzleChart);

  if (!isNozzle) return item;

  if (item.specs.compatibleBodyCategories) return item;

  if (
    item.category === "ROTOR" ||
    item.specs.nozzleFamily?.toString().startsWith("pgp") ||
    item.specs.nozzleFamily?.toString().startsWith("hunter_pgj") ||
    item.specs.nozzleFamily?.toString().startsWith("hunter_i20") ||
    item.specs.nozzleFamily?.toString().startsWith("rainbird_3500") ||
    item.specs.nozzleFamily?.toString().startsWith("rainbird_5000")
  ) {
    const chartMax = item.nozzleChart?.radiusFeet?.length
      ? Math.max(...item.nozzleChart.radiusFeet)
      : undefined;
    return {
      ...item,
      specs: {
        ...rotorNozzleSpecs(item.specs),
        ...(chartMax
          ? {
              radiusFeetMax: chartMax,
              radiusFeetMin: defaultMinRadius(chartMax),
              arcDegreesMin: 40,
              arcDegreesMax: 360,
              arcDegreesDefault: 180,
            }
          : {}),
      },
    };
  }

  return item;
}

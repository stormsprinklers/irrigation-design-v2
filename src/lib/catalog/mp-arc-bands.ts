import type { CatalogItemData } from "@/lib/domain/types";

export type MpArcBand = "90_210" | "210_270" | "360";

/** Hunter MP Rotator arc adjustment bands (factory-set range per nozzle SKU). */
export const MP_ARC_BANDS: Record<
  MpArcBand,
  { min: number; max: number; default: number; fixedLeftEdge: boolean }
> = {
  "90_210": { min: 90, max: 210, default: 180, fixedLeftEdge: true },
  "210_270": { min: 210, max: 270, default: 210, fixedLeftEdge: true },
  "360": { min: 360, max: 360, default: 360, fixedLeftEdge: false },
};

export function inferMpArcBand(nozzle: CatalogItemData): MpArcBand | undefined {
  const specBand = nozzle.specs.mpArcBand;
  if (specBand === "90_210" || specBand === "210_270" || specBand === "360") {
    return specBand;
  }

  const model = nozzle.model;
  if (/(?:^|-)360(?:°|$)/i.test(model) || /\b360\b/.test(model)) return "360";
  if (/(?:^|-)210(?:°|$)/i.test(model)) return "210_270";
  if (/(?:^|-)90(?:°|$)/i.test(model)) return "90_210";

  const arc = typeof nozzle.specs.arcDegrees === "number" ? nozzle.specs.arcDegrees : undefined;
  if (arc === undefined) return undefined;
  if (arc >= 360) return "360";
  if (arc >= 210 && arc <= 270) return "210_270";
  if (arc >= 40 && arc <= 210) return "90_210";
  return undefined;
}

export function chartReferenceArcDegrees(nozzle: CatalogItemData): number {
  const ref = nozzle.specs.chartReferenceArcDegrees;
  if (typeof ref === "number" && ref > 0) return ref;
  const def = nozzle.specs.arcDegreesDefault;
  if (typeof def === "number" && def > 0) return def;
  const band = inferMpArcBand(nozzle);
  if (band) return MP_ARC_BANDS[band].default;
  const arc = nozzle.specs.arcDegrees;
  if (typeof arc === "number" && arc > 0) return arc;
  return 360;
}

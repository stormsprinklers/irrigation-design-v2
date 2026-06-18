import type { CatalogItemData } from "../types";
import { isRotorNozzle } from "@/lib/catalog/adjustability";

/**
 * Rotor nozzles (PGP, PGJ, etc.): GPM is fixed by the nozzle SKU at a given pressure.
 * Spray / MP rotator nozzles: flow scales with adjusted arc.
 */
export function nozzleGpmScalesWithArc(nozzle: CatalogItemData): boolean {
  if (isRotorNozzle(nozzle)) return false;
  if (nozzle.category === "MP_ROTATOR") return true;
  if (nozzle.category === "SPRAY") return true;
  return true;
}

export type NozzleChartValues = {
  gpm: number;
  radiusFeet?: number;
  precipInPerHr?: number;
  precipTriInPerHr?: number;
};

/** Apply legacy spray arc flow scaling on top of chart-interpolated hydraulics. */
export function headGpmFromHydraulics(
  nozzle: CatalogItemData,
  hyd: NozzleChartValues,
  arcDegrees: number
): number {
  if (!nozzleGpmScalesWithArc(nozzle)) {
    return hyd.gpm;
  }
  const gpmScale = arcDegrees >= 360 ? 1 : arcDegrees / 360;
  return hyd.gpm * (arcDegrees <= 180 ? arcDegrees / 180 : gpmScale);
}

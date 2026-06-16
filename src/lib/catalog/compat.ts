import type { CatalogItemData, HeadFamily } from "@/lib/domain/types";
import { DEFAULT_PRESSURE_PSI } from "@/lib/domain/types";
import { calculateHeadGpm } from "@/lib/domain/hydraulics";
import {
  getBodyCategory,
  getCompatibleBodyCategories,
  resolveDefaultHeadSettings,
} from "@/lib/catalog/adjustability";

export function isHeadBody(item: CatalogItemData): boolean {
  return (
    item.category === "SPRAY_BODY" ||
    item.category === "ROTOR_BODY" ||
    item.specs.itemRole === "body"
  );
}

export function isNozzle(item: CatalogItemData): boolean {
  if (isHeadBody(item)) return false;
  return (
    item.category === "SPRAY" ||
    item.category === "ROTOR" ||
    item.category === "MP_ROTATOR" ||
    item.specs.itemRole === "nozzle" ||
    Boolean(item.nozzleChart)
  );
}

export function getHeadFamily(item: CatalogItemData): string | undefined {
  const family = item.specs.headFamily;
  return typeof family === "string" ? family : undefined;
}

export function getCompatibleHeadFamilies(item: CatalogItemData): string[] {
  const families = item.specs.compatibleHeadFamilies;
  if (Array.isArray(families)) {
    return families.filter((f): f is string => typeof f === "string");
  }
  const nozzleFamily = item.specs.nozzleFamily;
  if (typeof nozzleFamily === "string") {
    return [];
  }
  return [];
}

export function nozzleCompatibleWithHead(
  nozzle: CatalogItemData,
  head: CatalogItemData
): boolean {
  const headFamily = getHeadFamily(head);
  if (!headFamily) return false;
  const compatible = getCompatibleHeadFamilies(nozzle);
  if (compatible.length === 0 || !compatible.includes(headFamily)) return false;

  const bodyCategory = getBodyCategory(head);
  if (!bodyCategory) return false;
  const allowedBodies = getCompatibleBodyCategories(nozzle);
  return allowedBodies.includes(bodyCategory);
}

export function getNozzlesForHead(
  catalog: CatalogItemData[],
  headBodyId: string
): CatalogItemData[] {
  const head = catalog.find((c) => c.id === headBodyId);
  if (!head) return [];
  const headFamily = getHeadFamily(head);
  if (!headFamily) return [];
  return catalog.filter(
    (item) => isNozzle(item) && getCompatibleHeadFamilies(item).includes(headFamily)
  );
}

export function getHeadBodies(catalog: CatalogItemData[]): CatalogItemData[] {
  return catalog.filter(isHeadBody);
}

export function getDefaultNozzleForHead(
  catalog: CatalogItemData[],
  headBodyId: string
): CatalogItemData | undefined {
  const compatible = getNozzlesForHead(catalog, headBodyId);
  if (compatible.length === 0) return undefined;
  const head = catalog.find((c) => c.id === headBodyId);
  const family = head ? getHeadFamily(head) : undefined;

  if (family === "hunter_pgj") {
    return compatible.find((n) => n.id.includes("2_0") || n.model.includes("2.0")) ?? compatible[0];
  }
  if (family === "rainbird_3500") {
    return compatible.find((n) => n.model.includes("2.0")) ?? compatible[0];
  }
  if (family === "rainbird_5000") {
    return compatible.find((n) => n.model.includes("3.0")) ?? compatible[0];
  }
  if (family?.startsWith("hunter_pro_spray")) {
    return compatible.find((n) => n.id === "noz_hunter_mp3000_90") ?? compatible[0];
  }
  if (family?.startsWith("rainbird_1800")) {
    return (
      compatible.find((n) => n.id === "noz_rb_r_van14") ??
      compatible.find((n) => n.id.includes("rvan14")) ??
      compatible[0]
    );
  }
  return compatible[0];
}

export function catalogCategoryLabel(category: string): string {
  switch (category) {
    case "SPRAY_BODY":
      return "Spray body";
    case "ROTOR_BODY":
      return "Rotor body";
    case "SPRAY":
      return "Spray nozzle";
    case "ROTOR":
      return "Rotor nozzle";
    case "MP_ROTATOR":
      return "MP Rotator";
    default:
      return category;
  }
}

export function resolveHeadAssembly(
  catalog: CatalogItemData[],
  preference: HeadFamily,
  pressurePsi = DEFAULT_PRESSURE_PSI
): { headBodyId: string; nozzleId: string; radiusFeet: number; gpm: number; precipInPerHr?: number; arcDegrees: number; rotationDegrees: number } | null {
  const headPreferenceMap: Record<HeadFamily, string> = {
    SPRAY: "head_rb_1804",
    ROTOR: "head_hunter_pgp_ultra_4",
    MP_ROTATOR: "head_hunter_pros_prs40_04",
    DRIP: "head_rb_1804",
  };
  const headBodyId = headPreferenceMap[preference];
  const head = catalog.find((c) => c.id === headBodyId);
  if (!head) return null;
  const nozzle = getDefaultNozzleForHead(catalog, headBodyId);
  if (!nozzle) return null;
  const settings = resolveDefaultHeadSettings(nozzle, pressurePsi);
  return {
    headBodyId,
    nozzleId: nozzle.id,
    radiusFeet: settings.radiusFeet,
    gpm: settings.gpm ?? calculateHeadGpm(nozzle, pressurePsi).gpm,
    precipInPerHr: settings.precipInPerHr,
    arcDegrees: settings.arcDegrees,
    rotationDegrees: settings.rotationDegrees,
  };
}

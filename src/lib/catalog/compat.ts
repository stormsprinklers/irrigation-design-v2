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

/** Hunter MP SKUs: only 90–210, 210–270, and 360 bands (plus strips / corner). */
export function isValidMpRotatorPickerNozzle(nozzle: CatalogItemData): boolean {
  if (nozzle.specs.nozzleFamily !== "hunter_mp_rotator") return true;
  if (nozzle.specs.stripPattern || nozzle.specs.mpModel === "MP Corner") return true;

  const band = nozzle.specs.mpArcBand;
  if (band !== "90_210" && band !== "210_270" && band !== "360") return false;

  // Drop legacy PDF rows that still expose odd factory arcs in the model name.
  if (/\b(40|50)°/.test(nozzle.model)) return false;

  return true;
}

export function nozzleCompatibleWithHead(
  nozzle: CatalogItemData,
  head: CatalogItemData
): boolean {
  const bodyCategory = getBodyCategory(head);
  if (!bodyCategory) return false;

  if (!isNozzle(nozzle) || !isValidMpRotatorPickerNozzle(nozzle)) return false;

  const allowedBodies = getCompatibleBodyCategories(nozzle);
  if (!allowedBodies.includes(bodyCategory)) return false;

  if (bodyCategory === "SPRAY_BODY") {
    return allowedBodies.includes("SPRAY_BODY");
  }

  const headFamily = getHeadFamily(head);
  if (!headFamily) return false;
  const compatible = getCompatibleHeadFamilies(nozzle);
  return compatible.length > 0 && compatible.includes(headFamily);
}

export function getNozzlesForHead(
  catalog: CatalogItemData[],
  headBodyId: string
): CatalogItemData[] {
  const head = catalog.find((c) => c.id === headBodyId);
  if (!head) return [];
  const bodyCategory = getBodyCategory(head);
  if (!bodyCategory) return [];
  const headFamily = getHeadFamily(head);

  return catalog
    .filter((item) => {
      if (!isNozzle(item) || !isValidMpRotatorPickerNozzle(item)) return false;

      const allowedBodies = getCompatibleBodyCategories(item);
      if (!allowedBodies.includes(bodyCategory)) return false;

      if (bodyCategory === "SPRAY_BODY") {
        return allowedBodies.includes("SPRAY_BODY");
      }

      if (!headFamily) return false;
      const compatible = getCompatibleHeadFamilies(item);
      return compatible.length > 0 && compatible.includes(headFamily);
    })
    .sort((a, b) => a.model.localeCompare(b.model, undefined, { sensitivity: "base" }));
}

export function getHeadBodies(catalog: CatalogItemData[]): CatalogItemData[] {
  return catalog.filter(isHeadBody);
}

export type BodyPickerGroup = "spray" | "rotor";
export type NozzlePickerGroup = "fixed" | "rotary" | "van";

export const BODY_PICKER_GROUPS: { id: BodyPickerGroup; label: string }[] = [
  { id: "spray", label: "Spray" },
  { id: "rotor", label: "Rotor" },
];

export const NOZZLE_PICKER_GROUPS: { id: NozzlePickerGroup; label: string }[] = [
  { id: "fixed", label: "Fixed" },
  { id: "rotary", label: "Rotary" },
  { id: "van", label: "VAN" },
];

export function getBodyPickerGroup(body: CatalogItemData): BodyPickerGroup {
  return body.category === "ROTOR_BODY" ? "rotor" : "spray";
}

export function filterHeadBodiesByGroup(
  bodies: CatalogItemData[],
  group: BodyPickerGroup
): CatalogItemData[] {
  return bodies.filter((b) => getBodyPickerGroup(b) === group);
}

export function getNozzlePickerGroup(nozzle: CatalogItemData): NozzlePickerGroup {
  if (nozzle.specs.stripPattern) return "fixed";

  const family =
    typeof nozzle.specs.nozzleFamily === "string" ? nozzle.specs.nozzleFamily : "";

  if (
    nozzle.category === "MP_ROTATOR" ||
    family === "hunter_mp_rotator" ||
    family === "rainbird_rvan"
  ) {
    return "rotary";
  }

  if (
    family === "rainbird_he_van" ||
    family === "rainbird_van" ||
    (nozzle.category === "SPRAY" && nozzle.specs.arcAdjustable === true)
  ) {
    return "van";
  }

  return "fixed";
}

export function filterNozzlesByGroup(
  nozzles: CatalogItemData[],
  group: NozzlePickerGroup
): CatalogItemData[] {
  return nozzles
    .filter((n) => getNozzlePickerGroup(n) === group)
    .sort((a, b) => a.model.localeCompare(b.model, undefined, { sensitivity: "base" }));
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

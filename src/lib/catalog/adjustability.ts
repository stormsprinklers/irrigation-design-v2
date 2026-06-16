import type { CatalogItemData, SprinklerHead } from "@/lib/domain/types";
import { calculateHeadGpm } from "@/lib/domain/hydraulics";

export type BodyCategory = "SPRAY_BODY" | "ROTOR_BODY";
export type MpArcBand = "90_210" | "210_270" | "360";

export type NozzleAdjustability = {
  compatibleBodyCategories: BodyCategory[];
  arcDegreesMin: number;
  arcDegreesMax: number;
  arcDegreesDefault: number;
  radiusFeetMin: number;
  radiusFeetMax: number;
  arcAdjustable: boolean;
  radiusAdjustable: boolean;
  rotationAdjustable: boolean;
  fixedLeftEdge: boolean;
  mpArcBand?: MpArcBand;
};

export type HeadBodyAdjustability = {
  bodyCategory: BodyCategory;
  arcDegreesMin: number;
  arcDegreesMax: number;
  rotationAdjustable: boolean;
};

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function getBodyCategory(item: CatalogItemData): BodyCategory | undefined {
  if (item.category === "SPRAY_BODY") return "SPRAY_BODY";
  if (item.category === "ROTOR_BODY") return "ROTOR_BODY";
  return undefined;
}

export function getCompatibleBodyCategories(nozzle: CatalogItemData): BodyCategory[] {
  const raw = nozzle.specs.compatibleBodyCategories;
  if (Array.isArray(raw)) {
    return raw.filter((c): c is BodyCategory => c === "SPRAY_BODY" || c === "ROTOR_BODY");
  }
  if (nozzle.category === "MP_ROTATOR" || nozzle.specs.nozzleFamily === "rainbird_rvan") {
    return ["SPRAY_BODY"];
  }
  if (nozzle.category === "ROTOR" || nozzle.nozzleChart) {
    return ["ROTOR_BODY"];
  }
  return ["SPRAY_BODY"];
}

export function getNozzleAdjustability(nozzle: CatalogItemData): NozzleAdjustability {
  const chartMax = nozzle.nozzleChart?.radiusFeet?.length
    ? Math.max(...nozzle.nozzleChart.radiusFeet)
    : 12;
  const radiusMax = num(nozzle.specs.radiusFeetMax, chartMax);
  const radiusMin = num(nozzle.specs.radiusFeetMin, Math.round(radiusMax * 0.75 * 100) / 100);
  const arcDefault = num(nozzle.specs.arcDegreesDefault, num(nozzle.specs.arcDegrees, 360));
  const arcMin = num(nozzle.specs.arcDegreesMin, arcDefault);
  const arcMax = num(nozzle.specs.arcDegreesMax, arcDefault);

  return {
    compatibleBodyCategories: getCompatibleBodyCategories(nozzle),
    arcDegreesMin: arcMin,
    arcDegreesMax: arcMax,
    arcDegreesDefault: arcDefault,
    radiusFeetMin: radiusMin,
    radiusFeetMax: radiusMax,
    arcAdjustable: bool(nozzle.specs.arcAdjustable, arcMin !== arcMax),
    radiusAdjustable: bool(nozzle.specs.radiusAdjustable, radiusMin !== radiusMax),
    rotationAdjustable: bool(nozzle.specs.rotationAdjustable, true),
    fixedLeftEdge: bool(nozzle.specs.fixedLeftEdge, false),
    mpArcBand:
      nozzle.specs.mpArcBand === "90_210" ||
      nozzle.specs.mpArcBand === "210_270" ||
      nozzle.specs.mpArcBand === "360"
        ? (nozzle.specs.mpArcBand as MpArcBand)
        : undefined,
  };
}

export function getHeadBodyAdjustability(head: CatalogItemData): HeadBodyAdjustability {
  const bodyCategory = getBodyCategory(head);
  return {
    bodyCategory: bodyCategory ?? "SPRAY_BODY",
    arcDegreesMin: num(head.specs.arcDegreesMin, bodyCategory === "ROTOR_BODY" ? 40 : 0),
    arcDegreesMax: num(head.specs.arcDegreesMax, 360),
    rotationAdjustable: true,
  };
}

export function resolveDefaultHeadSettings(
  nozzle: CatalogItemData,
  pressurePsi = 45
): Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees" | "gpm" | "precipInPerHr"> {
  const adj = getNozzleAdjustability(nozzle);
  const hydraulics = calculateHeadGpm(nozzle, pressurePsi);
  const radiusFeet = Math.min(
    adj.radiusFeetMax,
    Math.max(adj.radiusFeetMin, hydraulics.radiusFeet ?? adj.radiusFeetMax)
  );

  return {
    arcDegrees: adj.arcDegreesDefault,
    radiusFeet,
    rotationDegrees: 0,
    gpm: hydraulics.gpm,
    precipInPerHr: hydraulics.precipInPerHr,
  };
}

export function clampHeadToNozzle(
  head: Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees">,
  nozzle: CatalogItemData
): Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees"> {
  const adj = getNozzleAdjustability(nozzle);
  return {
    arcDegrees: Math.min(adj.arcDegreesMax, Math.max(adj.arcDegreesMin, head.arcDegrees)),
    radiusFeet: Math.min(adj.radiusFeetMax, Math.max(adj.radiusFeetMin, head.radiusFeet)),
    rotationDegrees: ((head.rotationDegrees % 360) + 360) % 360,
  };
}

export function isSprayNozzle(nozzle: CatalogItemData): boolean {
  return getCompatibleBodyCategories(nozzle).includes("SPRAY_BODY");
}

export function isRotorNozzle(nozzle: CatalogItemData): boolean {
  return getCompatibleBodyCategories(nozzle).includes("ROTOR_BODY");
}

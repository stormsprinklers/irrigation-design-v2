import type { CatalogItemData, Point, SpacingPattern, SprinklerHead } from "@/lib/domain/types";
import { DEFAULT_PRESSURE_PSI } from "@/lib/domain/types";
import { calculateNozzleHydraulics } from "@/lib/domain/hydraulics";
import { wedgeEndDeg, wedgeStartDeg } from "@/lib/domain/placement/wedge";
import {
  MP_ARC_BANDS,
  inferMpArcBand,
  type MpArcBand,
} from "@/lib/catalog/mp-arc-bands";
import { getStripNozzleSpec } from "@/lib/catalog/strip-pattern";

export type { MpArcBand };
export { MP_ARC_BANDS, inferMpArcBand };

export type BodyCategory = "SPRAY_BODY" | "ROTOR_BODY";

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

/** Rotor throw adjustment: ~50%–100% of chart max radius. */
export function rotorMinRadiusFeet(radiusMax: number): number {
  return Math.round(radiusMax * 0.5 * 100) / 100;
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
  const isRotor = getCompatibleBodyCategories(nozzle).includes("ROTOR_BODY");
  const catalogRadiusMin = num(nozzle.specs.radiusFeetMin, radiusMax);
  const fixedRotorRadius = isRotor && catalogRadiusMin === radiusMax;
  const radiusMin = isRotor
    ? fixedRotorRadius
      ? catalogRadiusMin
      : rotorMinRadiusFeet(radiusMax)
    : num(nozzle.specs.radiusFeetMin, Math.round(radiusMax * 0.75 * 100) / 100);

  const mpBand =
    nozzle.category === "MP_ROTATOR" ? inferMpArcBand(nozzle) : undefined;
  const bandSpec = mpBand ? MP_ARC_BANDS[mpBand] : undefined;

  const arcDefault = bandSpec
    ? bandSpec.default
    : num(nozzle.specs.arcDegreesDefault, num(nozzle.specs.arcDegrees, 360));
  const arcMin = bandSpec
    ? bandSpec.min
    : num(nozzle.specs.arcDegreesMin, arcDefault);
  const arcMax = bandSpec
    ? bandSpec.max
    : num(nozzle.specs.arcDegreesMax, arcDefault);

  const hasExplicitArcRange =
    typeof nozzle.specs.arcDegreesMin === "number" &&
    typeof nozzle.specs.arcDegreesMax === "number" &&
    nozzle.specs.arcDegreesMin !== nozzle.specs.arcDegreesMax;

  const arcAdjustable = bandSpec
    ? mpBand !== "360"
    : isRotor && arcMax > arcMin
      ? true
      : bool(nozzle.specs.arcAdjustable, hasExplicitArcRange || arcMin !== arcMax);

  return {
    compatibleBodyCategories: getCompatibleBodyCategories(nozzle),
    arcDegreesMin: arcMin,
    arcDegreesMax: arcMax,
    arcDegreesDefault: arcDefault,
    radiusFeetMin: radiusMin,
    radiusFeetMax: radiusMax,
    arcAdjustable,
    radiusAdjustable: isRotor
      ? !fixedRotorRadius && radiusMax > radiusMin
      : bool(nozzle.specs.radiusAdjustable, radiusMin !== radiusMax),
    rotationAdjustable: bool(nozzle.specs.rotationAdjustable, true),
    fixedLeftEdge: bandSpec
      ? bandSpec.fixedLeftEdge
      : bool(nozzle.specs.fixedLeftEdge, false),
    mpArcBand: mpBand,
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
  pressurePsi = DEFAULT_PRESSURE_PSI
): Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees" | "gpm" | "precipInPerHr"> {
  const strip = getStripNozzleSpec(nozzle);
  if (strip) {
    const hydraulics = calculateNozzleHydraulics(nozzle, pressurePsi, 180);
    return {
      arcDegrees: 180,
      radiusFeet: strip.patternWidthFt,
      rotationDegrees: 0,
      gpm: hydraulics.gpm,
      precipInPerHr: hydraulics.precipInPerHr,
    };
  }

  const adj = getNozzleAdjustability(nozzle);
  const hydraulics = calculateNozzleHydraulics(nozzle, pressurePsi, adj.arcDegreesDefault);
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

/** Swap nozzle on a head without changing arc, radius, or rotation; recalculates flow only. */
export function swapHeadNozzle(
  head: Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees">,
  nozzle: CatalogItemData,
  pressurePsi = DEFAULT_PRESSURE_PSI,
  pattern?: SpacingPattern
): Pick<SprinklerHead, "gpm" | "precipInPerHr"> {
  const hyd = calculateNozzleHydraulics(nozzle, pressurePsi, head.arcDegrees, pattern);
  const gpmScale = head.arcDegrees >= 360 ? 1 : head.arcDegrees / 360;
  const gpm =
    hyd.gpm * (head.arcDegrees <= 180 ? head.arcDegrees / 180 : gpmScale);
  return {
    gpm,
    precipInPerHr: pattern === "triangular" ? hyd.precipTriInPerHr : hyd.precipInPerHr,
  };
}

export function patchHeadWithNozzle(
  head: Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees" | "gpm" | "precipInPerHr">,
  partial: Partial<Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees">>,
  nozzle: CatalogItemData,
  pressurePsi = DEFAULT_PRESSURE_PSI
): Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees" | "gpm" | "precipInPerHr"> {
  const clamped = clampHeadToNozzle({ ...head, ...partial }, nozzle);
  const hydraulics = calculateNozzleHydraulics(
    nozzle,
    pressurePsi,
    clamped.arcDegrees
  );
  return {
    ...clamped,
    gpm: hydraulics.gpm,
    precipInPerHr: hydraulics.precipInPerHr,
  };
}

export function wedgeBoundsForHead(
  head: Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees"> & {
    position?: Point;
    positionFt?: Point;
  }
): { wedgeStartDeg: number; wedgeEndDeg: number } {
  const position = head.position ?? head.positionFt;
  if (!position) {
    return { wedgeStartDeg: 0, wedgeEndDeg: head.arcDegrees };
  }
  const wedgeHead = {
    position,
    arcDegrees: head.arcDegrees,
    radiusFeet: head.radiusFeet,
    rotationDegrees: head.rotationDegrees,
  };
  return {
    wedgeStartDeg: wedgeStartDeg(wedgeHead),
    wedgeEndDeg: wedgeEndDeg(wedgeHead),
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

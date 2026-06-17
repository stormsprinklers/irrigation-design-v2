import type { CatalogItemData, HydrozonePolygon, SprinklerHead } from "../types";
import { placeHeads } from "../placement";
import { wedgeEndDeg, wedgeStartDeg } from "../placement/wedge";
import { stripFieldsFromNozzle } from "@/lib/catalog/strip-pattern";
import type {
  GeneratedTrainingPolygon,
  TrainingHeadSnapshot,
  TrainingPlacementContext,
} from "./types";
import { TRAINING_FEET_SCALE, TRAINING_PPF } from "./types";

const DEFAULT_ZONE_ID = "training-zone-1";
const DEFAULT_HYDROZONE_ID = "training-hz-1";

export type RunPlacementResult = {
  heads: TrainingHeadSnapshot[];
  placementContext: TrainingPlacementContext;
  warnings: ReturnType<typeof placeHeads>["warnings"];
  radiusFeet?: number;
  pattern?: ReturnType<typeof placeHeads>["pattern"];
};

function toSnapshot(head: SprinklerHead, catalog: CatalogItemData[]): TrainingHeadSnapshot {
  const nozzle = catalog.find((c) => c.id === head.catalogItemId);
  const wedgeHead = {
    position: head.position,
    arcDegrees: head.arcDegrees,
    radiusFeet: head.radiusFeet,
    rotationDegrees: head.rotationDegrees,
  };
  return {
    id: head.id,
    positionFt: { x: head.position.x, y: head.position.y },
    radiusFeet: head.radiusFeet,
    arcDegrees: head.arcDegrees,
    rotationDegrees: head.rotationDegrees,
    wedgeStartDeg: wedgeStartDeg(wedgeHead),
    wedgeEndDeg: wedgeEndDeg(wedgeHead),
    catalogItemId: head.catalogItemId,
    headBodyId: head.headBodyId,
    nozzleModel: nozzle?.model,
    gpm: head.gpm,
    precipInPerHr: head.precipInPerHr,
    ...(nozzle ? stripFieldsFromNozzle(nozzle) : {}),
  };
}

export function snapshotsToSprinklerHeads(
  snapshots: TrainingHeadSnapshot[],
  zoneId = DEFAULT_ZONE_ID,
  hydrozoneId = DEFAULT_HYDROZONE_ID
): SprinklerHead[] {
  return snapshots.map((s) => ({
    id: s.id,
    zoneId,
    hydrozoneId,
    position: { x: s.positionFt.x, y: s.positionFt.y },
    catalogItemId: s.catalogItemId,
    headBodyId: s.headBodyId,
    arcDegrees: s.arcDegrees,
    radiusFeet: s.radiusFeet,
    rotationDegrees: s.rotationDegrees,
    gpm: s.gpm,
    precipInPerHr: s.precipInPerHr,
    locked: false,
  }));
}

export function runPlacementOnPolygon(
  generated: GeneratedTrainingPolygon,
  catalog: CatalogItemData[],
  pressurePsi = 65
): RunPlacementResult {
  const hydrozone: HydrozonePolygon = {
    id: DEFAULT_HYDROZONE_ID,
    name: "Training Lawn",
    vertices: generated.verticesFt,
    hydrozoneType: "TURF",
    sunExposure: "FULL_SUN",
    slopePercent: 0,
    soilType: "LOAM",
    waterPriority: 3,
    headPreference: "ROTOR",
  };

  const result = placeHeads({
    hydrozone,
    zoneId: DEFAULT_ZONE_ID,
    catalog,
    scale: TRAINING_FEET_SCALE,
    exclusionZones: generated.exclusionZonesFt,
    pressurePsi,
  });

  const catalogItemIds = [...new Set(result.heads.map((h) => h.catalogItemId))];

  return {
    heads: result.heads.map((h) => toSnapshot(h, catalog)),
    placementContext: {
      headPreference: "ROTOR",
      pressurePsi,
      pattern: result.pattern,
      nozzleModel: result.nozzleModel,
      catalogItemIds,
    },
    warnings: result.warnings,
    radiusFeet: result.radiusFeet,
    pattern: result.pattern,
  };
}

export { TRAINING_PPF, DEFAULT_HYDROZONE_ID, DEFAULT_ZONE_ID };

import {
  calculateFrictionLoss,
  calculateHeadGpm,
  calculatePipeVelocity,
  pixelsPerFoot,
  polylineLengthFeet,
} from "../hydraulics";
import type {
  CatalogItemData,
  DesignDocument,
  IrrigationZone,
  SprinklerHead,
  ValidationIssue,
  WaterSourceConfig,
  ZoneHydraulics,
} from "../types";
import { DEFAULT_PRESSURE_PSI } from "../types";

export function calculateZoneHydraulics(
  zone: IrrigationZone,
  heads: SprinklerHead[],
  pipes: DesignDocument["pipes"],
  waterSource: WaterSourceConfig | undefined,
  catalog: CatalogItemData[],
  scale: DesignDocument["scale"]
): ZoneHydraulics {
  const zoneHeads = heads.filter((h) => h.zoneId === zone.id);
  const zonePipes = pipes.filter((p) => p.zoneId === zone.id);
  const catalogMap = new Map(catalog.map((c) => [c.id, c]));
  const pressure = waterSource?.staticPressurePsi ?? DEFAULT_PRESSURE_PSI;

  let totalGpm = 0;
  let minPressure = pressure;

  for (const head of zoneHeads) {
    const item = catalogMap.get(head.catalogItemId);
    if (!item) continue;
    const hyd = calculateHeadGpm(item, pressure);
    totalGpm += hyd.gpm;
    const estimatedDynamic = pressure - hyd.gpm * 0.15;
    minPressure = Math.min(minPressure, estimatedDynamic);
  }

  const velocityWarnings: ValidationIssue[] = [];
  const ppf = pixelsPerFoot(scale);

  for (const pipe of zonePipes) {
    const lengthFeet =
      pipe.lengthFeet ??
      (ppf ? polylineLengthFeet(pipe.points, ppf) : pipe.points.length * 2);
    const friction = calculateFrictionLoss(totalGpm, pipe.diameterInches, lengthFeet);
    pipe.frictionLossPsi = friction;
    const velocity = calculatePipeVelocity(totalGpm, pipe.diameterInches);
    if (velocity > 5) {
      velocityWarnings.push({
        code: "VELOCITY_HIGH",
        severity: "warning",
        message: `Pipe velocity ${velocity.toFixed(1)} ft/s exceeds 5 ft/s`,
        entityIds: [pipe.id],
        suggestedAction: "Upsize pipe diameter",
      });
    }
    minPressure -= friction;
  }

  if (waterSource && totalGpm > waterSource.availableGpm) {
    velocityWarnings.push({
      code: "FLOW_EXCEEDED",
      severity: "critical",
      message: `Zone uses ${totalGpm.toFixed(1)} GPM but only ${waterSource.availableGpm} GPM available`,
      entityIds: [zone.id],
    });
  }

  if (minPressure < 30) {
    velocityWarnings.push({
      code: "PRESSURE_LOW",
      severity: "warning",
      message: `Estimated pressure at critical head is ${minPressure.toFixed(1)} PSI`,
      entityIds: [zone.id],
    });
  }

  return {
    zoneId: zone.id,
    totalGpm: Math.round(totalGpm * 100) / 100,
    criticalHeadPressurePsi: Math.round(minPressure * 100) / 100,
    velocityWarnings,
  };
}

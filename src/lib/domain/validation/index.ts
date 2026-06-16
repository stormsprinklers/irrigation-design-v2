import { calculateZoneHydraulics } from "../hydraulics/zone";
import { pixelsPerFoot } from "../hydraulics";
import type {
  CatalogItemData,
  DesignDocument,
  ValidationIssue,
} from "../types";
import { wedgeHitsExclusion } from "../placement/wedge";

function headFamiliesInZone(
  zoneId: string,
  doc: DesignDocument,
  catalog: CatalogItemData[]
): Set<string> {
  const catalogMap = new Map(catalog.map((c) => [c.id, c]));
  const families = new Set<string>();
  for (const head of doc.heads.filter((h) => h.zoneId === zoneId)) {
    const item = catalogMap.get(head.catalogItemId);
    if (item) families.add(item.category);
  }
  return families;
}

function precipRatesInHydrozone(hydrozoneId: string, doc: DesignDocument): number[] {
  return doc.heads
    .filter((h) => h.hydrozoneId === hydrozoneId && h.precipInPerHr)
    .map((h) => h.precipInPerHr!);
}

export function validateDesign(
  doc: DesignDocument,
  catalog: CatalogItemData[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!doc.scale) {
    issues.push({
      code: "SCALE_MISSING",
      severity: "warning",
      message: "Scale not calibrated — pipe sizing and spacing may be inaccurate",
      entityIds: [],
      suggestedAction: "Calibrate scale using a known distance",
    });
  }

  if (!doc.waterSource) {
    issues.push({
      code: "WATER_SOURCE_MISSING",
      severity: "warning",
      message: "Water source not configured",
      entityIds: [],
      suggestedAction: "Enter static pressure and available GPM",
    });
  }

  for (const zone of doc.zones) {
    const families = headFamiliesInZone(zone.id, doc, catalog);
    if (families.size > 1) {
      issues.push({
        code: "MIXED_HEAD_TYPES",
        severity: "warning",
        message: `${zone.name} mixes ${[...families].join(", ")} head types`,
        entityIds: [zone.id],
        suggestedAction: "Separate spray and rotor zones",
      });
    }

    const hydraulics = calculateZoneHydraulics(
      zone,
      doc.heads,
      doc.pipes,
      doc.waterSource,
      catalog,
      doc.scale
    );
    issues.push(...hydraulics.velocityWarnings);
  }

  for (const hydrozone of doc.hydrozones) {
    const precips = precipRatesInHydrozone(hydrozone.id, doc);
    if (precips.length > 1) {
      const min = Math.min(...precips);
      const max = Math.max(...precips);
      if (max - min > 0.3) {
        issues.push({
          code: "PRECIP_MISMATCH",
          severity: "warning",
          message: `${hydrozone.name} has mismatched precipitation rates (${min.toFixed(1)}–${max.toFixed(1)} in/hr)`,
          entityIds: [hydrozone.id],
        });
      }
    }
  }

  if (doc.heads.length === 0 && doc.hydrozones.length > 0) {
    issues.push({
      code: "MANUAL_REVIEW",
      severity: "info",
      message: "Hydrozones defined but no heads placed yet",
      entityIds: doc.hydrozones.map((h) => h.id),
    });
  }

  const ppf = pixelsPerFoot(doc.scale);
  if (ppf && doc.heads.length > 0 && doc.exclusionZones.length > 0) {
    for (const head of doc.heads) {
      for (const ex of doc.exclusionZones) {
        const wedgeHead = {
          position: head.position,
          arcDegrees: head.arcDegrees,
          radiusFeet: head.radiusFeet,
          rotationDegrees: head.rotationDegrees,
        };
        if (wedgeHitsExclusion(wedgeHead, [ex], ppf)) {
          issues.push({
            code: "OVERSPRAY_EXCLUSION",
            severity: "warning",
            message: `Head spray wedge intersects ${ex.name}`,
            entityIds: [head.id, ex.id],
            suggestedAction: "Reduce radius, adjust arc, or reposition head",
          });
        }
      }
    }
  }

  return issues;
}

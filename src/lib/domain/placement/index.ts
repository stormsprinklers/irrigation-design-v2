import { generateId } from "@/lib/utils";
import { feetToPixels, pixelsPerFoot, calculateHeadGpm } from "../hydraulics";
import {
  getDefaultNozzleForHead,
  resolveHeadAssembly,
} from "@/lib/catalog/compat";
import type {
  CatalogItemData,
  DesignDocument,
  ExclusionZone,
  HydrozonePolygon,
  PlacementResult,
  Point,
  SprinklerHead,
  ValidationIssue,
} from "../types";

type PlacementInput = {
  hydrozone: HydrozonePolygon;
  zoneId: string;
  catalog: CatalogItemData[];
  scale: DesignDocument["scale"];
  exclusionZones: ExclusionZone[];
  defaultNozzleId?: string;
};

function polygonBounds(vertices: Point[]) {
  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function pointInPolygon(point: Point, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isInExclusion(point: Point, exclusions: ExclusionZone[]): boolean {
  return exclusions.some((z) => pointInPolygon(point, z.vertices));
}

export function placeHeads(input: PlacementInput): PlacementResult {
  const { hydrozone, zoneId, catalog, scale, exclusionZones } = input;
  const warnings: ValidationIssue[] = [];
  const ppf = pixelsPerFoot(scale);

  if (!ppf) {
    return {
      heads: [],
      coveragePercent: 0,
      warnings: [
        {
          code: "SCALE_MISSING",
          severity: "critical",
          message: "Scale calibration required before auto placement",
          entityIds: [hydrozone.id],
        },
      ],
    };
  }

  const assembly =
    resolveHeadAssembly(catalog, hydrozone.headPreference) ??
    (() => {
      const fallbackHead = catalog.find((c) => c.id === "head_rb_1804");
      const fallbackNozzle = fallbackHead
        ? getDefaultNozzleForHead(catalog, fallbackHead.id)
        : catalog.find((c) => c.nozzleChart);
      if (!fallbackHead || !fallbackNozzle) return null;
      const hydraulics = calculateHeadGpm(fallbackNozzle, 45);
      return {
        headBodyId: fallbackHead.id,
        nozzleId: fallbackNozzle.id,
        radiusFeet: hydraulics.radiusFeet ?? 12,
        gpm: hydraulics.gpm,
        precipInPerHr: hydraulics.precipInPerHr,
      };
    })();

  if (!assembly) {
    return {
      heads: [],
      coveragePercent: 0,
      warnings: [
        {
          code: "MANUAL_REVIEW",
          severity: "warning",
          message: "No compatible head and nozzle found in catalog",
          entityIds: [hydrozone.id],
        },
      ],
    };
  }

  const sprayNozzle = catalog.find((c) => c.id === assembly.nozzleId)!;
  const radiusFeet = assembly.radiusFeet;
  const spacingFeet = radiusFeet * 0.5;
  const spacingPx = feetToPixels(spacingFeet, ppf);
  const radiusPx = feetToPixels(radiusFeet, ppf);

  const bounds = polygonBounds(hydrozone.vertices);
  const heads: SprinklerHead[] = [];
  let gridPoints = 0;
  let coveredPoints = 0;

  for (let y = bounds.minY + spacingPx / 2; y <= bounds.maxY; y += spacingPx) {
    for (let x = bounds.minX + spacingPx / 2; x <= bounds.maxX; x += spacingPx) {
      const point = { x, y };
      gridPoints++;
      if (!pointInPolygon(point, hydrozone.vertices)) continue;
      if (isInExclusion(point, exclusionZones)) continue;

      coveredPoints++;
      heads.push({
        id: generateId("head"),
        zoneId,
        hydrozoneId: hydrozone.id,
        position: point,
        headBodyId: assembly.headBodyId,
        catalogItemId: assembly.nozzleId,
        arcDegrees: (sprayNozzle.specs.arcDegrees as number) ?? 360,
        radiusFeet,
        rotationDegrees: 0,
        gpm: assembly.gpm,
        precipInPerHr: assembly.precipInPerHr,
        locked: false,
      });
    }
  }

  const coveragePercent =
    gridPoints > 0 ? Math.round((coveredPoints / gridPoints) * 100) : 0;

  if (coveragePercent < 85) {
    warnings.push({
      code: "COVERAGE_GAP",
      severity: "warning",
      message: `Coverage is ${coveragePercent}% head-to-head compliant in ${hydrozone.name}`,
      entityIds: [hydrozone.id],
      suggestedAction: "Add manual heads or adjust spacing",
    });
  }

  if (heads.length > 1) {
    const idealSpacing = radiusPx;
    let spacingIssues = 0;
    for (let i = 0; i < heads.length; i++) {
      for (let j = i + 1; j < heads.length; j++) {
        const d = Math.hypot(
          heads[i].position.x - heads[j].position.x,
          heads[i].position.y - heads[j].position.y
        );
        if (d > idealSpacing * 1.08) spacingIssues++;
      }
    }
    if (spacingIssues > 0) {
      warnings.push({
        code: "HEAD_SPACING",
        severity: "warning",
        message: `${spacingIssues} head pairs exceed ideal spacing by 8%`,
        entityIds: heads.map((h) => h.id),
      });
    }
  }

  return { heads, coveragePercent, warnings };
}

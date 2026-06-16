import { pixelsPerFoot } from "../hydraulics";
import { DEFAULT_PRESSURE_PSI } from "../types";
import type {
  CatalogItemData,
  DesignDocument,
  ExclusionZone,
  HydrozonePolygon,
  PlacementResult,
  ValidationIssue,
} from "../types";
import { evaluateCoverage } from "./coverage";
import { analyzePolygon, detectSpacingPattern } from "./geometry";
import {
  refineSpacingRadius,
  selectNozzleAssembly,
} from "./nozzle-selection";
import { placeCornerHeads } from "./place-corners";
import { placeEdgeHeads } from "./place-edges";
import { placeInteriorHeads } from "./place-interior";

type PlacementInput = {
  hydrozone: HydrozonePolygon;
  zoneId: string;
  catalog: CatalogItemData[];
  scale: DesignDocument["scale"];
  exclusionZones: ExclusionZone[];
  pressurePsi?: number;
};

export { pointInPolygon } from "./geometry";

export function placeHeads(input: PlacementInput): PlacementResult {
  const { hydrozone, zoneId, catalog, scale, exclusionZones } = input;
  const warnings: ValidationIssue[] = [];
  const ppf = pixelsPerFoot(scale);
  const pressurePsi = input.pressurePsi ?? DEFAULT_PRESSURE_PSI;

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

  if (hydrozone.headPreference === "DRIP") {
    return {
      heads: [],
      coveragePercent: 0,
      warnings: [
        {
          code: "MANUAL_REVIEW",
          severity: "info",
          message: "Drip hydrozones require manual emitter placement",
          entityIds: [hydrozone.id],
        },
      ],
    };
  }

  const analysis = analyzePolygon(hydrozone.vertices, ppf);
  const pattern = detectSpacingPattern(
    analysis.interiorAnglesDeg,
    hydrozone.spacingPattern
  );

  const assembly = selectNozzleAssembly(
    catalog,
    hydrozone.headPreference,
    analysis,
    pressurePsi
  );

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

  const radiusFeet = refineSpacingRadius(analysis, assembly);
  const shared = {
    zoneId,
    hydrozoneId: hydrozone.id,
    vertices: hydrozone.vertices,
    analysis,
    assembly,
    radiusFeet,
    pressurePsi,
    pattern,
    exclusions: exclusionZones,
    ppf,
  };

  const cornerHeads = placeCornerHeads(shared);
  const edgeHeads = placeEdgeHeads({
    ...shared,
    existingHeads: cornerHeads,
  });
  const interiorHeads = placeInteriorHeads({
    ...shared,
    existingHeads: [...cornerHeads, ...edgeHeads],
  });

  const heads = [...cornerHeads, ...edgeHeads, ...interiorHeads];

  if (heads.length === 0) {
    warnings.push({
      code: "COVERAGE_GAP",
      severity: "warning",
      message: `No heads could be placed in ${hydrozone.name}`,
      entityIds: [hydrozone.id],
      suggestedAction: "Check exclusions or hydrozone shape",
    });
    return { heads, coveragePercent: 0, warnings };
  }

  const { coverage, warnings: coverageWarnings } = evaluateCoverage(
    heads,
    analysis,
    ppf,
    hydrozone.id,
    hydrozone.name,
    radiusFeet
  );
  warnings.push(...coverageWarnings);

  return {
    heads,
    coveragePercent: coverage.coveragePercent,
    overlapPercent: coverage.overlapPercent,
    pattern,
    nozzleModel: assembly.nozzle.model,
    radiusFeet,
    warnings,
  };
}

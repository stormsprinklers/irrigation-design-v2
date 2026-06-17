import { getNozzleAdjustability } from "@/lib/catalog/adjustability";
import { feetToPixels, pixelsPerFoot } from "../hydraulics";
import { DEFAULT_PRESSURE_PSI } from "../types";
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
import {
  assignArcsAndRotations,
  buildPlacementGraph,
  finalizeHeadHydraulics,
} from "./assign-arcs";
import { evaluateCoverage } from "./coverage";
import { resolveHydrozoneSpacing } from "./edge-spacing";
import { analyzePolygon, detectSpacingPattern } from "./geometry";
import { selectNozzleAssembly } from "./nozzle-selection";
import {
  assignPgpAdjNozzlesToHeads,
  isPgpAdjAssembly,
} from "./pgp-adj-placement";
import { placeCornerHeads } from "./place-corners";
import { placeEdgeHeads } from "./place-edges";
import { interiorGridOrigin, placeInteriorHeads } from "./place-interior";

type PlacementInput = {
  hydrozone: HydrozonePolygon;
  zoneId: string;
  catalog: CatalogItemData[];
  scale: DesignDocument["scale"];
  exclusionZones: ExclusionZone[];
  pressurePsi?: number;
};

export { pointInPolygon } from "./geometry";

function headPositionKey(p: Point): string {
  return `${Math.round(p.x * 1000)}:${Math.round(p.y * 1000)}`;
}

function dedupeNearbyHeads(
  cornerHeads: SprinklerHead[],
  edgeHeads: SprinklerHead[],
  vertices: Point[],
  ppf: number,
  radiusFeet: number
): SprinklerHead[] {
  const minDistPx = feetToPixels(radiusFeet * 0.45, ppf);
  const vertexKeys = new Set(vertices.map((v) => headPositionKey(v)));

  const keptEdge: SprinklerHead[] = [];
  for (const head of edgeHeads) {
    if (vertexKeys.has(headPositionKey(head.position))) continue;

    const tooClose = [...cornerHeads, ...keptEdge].some(
      (existing) =>
        Math.hypot(existing.position.x - head.position.x, existing.position.y - head.position.y) <
        minDistPx
    );
    if (!tooClose) keptEdge.push(head);
  }

  return [...cornerHeads, ...keptEdge];
}

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

  const adj = getNozzleAdjustability(assembly.nozzle);
  const { radiusFeet, runs: edgeRuns } = resolveHydrozoneSpacing(
    analysis,
    adj,
    assembly.radiusFeet
  );

  const spacingFt = radiusFeet;
  const shared = {
    zoneId,
    hydrozoneId: hydrozone.id,
    vertices: hydrozone.vertices,
    analysis,
    assembly: { ...assembly, radiusFeet },
    radiusFeet,
    pattern,
    exclusions: exclusionZones,
    ppf,
  };

  const cornerHeads = placeCornerHeads({
    zoneId,
    hydrozoneId: hydrozone.id,
    vertices: hydrozone.vertices,
    analysis,
    assembly: shared.assembly,
    radiusFeet,
  });

  const edgeHeads = placeEdgeHeads({
    zoneId,
    hydrozoneId: hydrozone.id,
    edgeRuns,
    assembly: shared.assembly,
    radiusFeet,
    ppf,
  });

  const perimeterHeads = dedupeNearbyHeads(
    cornerHeads,
    edgeHeads,
    hydrozone.vertices,
    ppf,
    radiusFeet
  );
  const gridOrigin = interiorGridOrigin(hydrozone.vertices, analysis.orientationDeg);

  const interiorHeads = placeInteriorHeads({
    ...shared,
    existingHeads: perimeterHeads,
    gridOrigin,
  });

  let heads = [...perimeterHeads, ...interiorHeads];

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

  const graph = buildPlacementGraph(heads, hydrozone.vertices, edgeRuns, ppf);
  const { heads: orientedHeads, oversprayHeadIds } = assignArcsAndRotations(
    heads,
    graph,
    hydrozone.vertices,
    edgeRuns,
    analysis,
    spacingFt,
    ppf,
    adj,
    exclusionZones
  );

  heads = isPgpAdjAssembly(assembly)
    ? assignPgpAdjNozzlesToHeads(catalog, orientedHeads, pressurePsi, pattern)
    : finalizeHeadHydraulics(orientedHeads, assembly.nozzle, pressurePsi, pattern);

  for (const headId of oversprayHeadIds) {
    warnings.push({
      code: "OVERSPRAY_EXCLUSION",
      severity: "warning",
      message: `Head could not fully avoid exclusion zone after radius/rotation adjustment`,
      entityIds: [headId],
      suggestedAction: "Reposition manually or adjust exclusion boundary",
    });
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

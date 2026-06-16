import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { CatalogItemData, HydrozonePolygon, Point } from "../../types";
import { placeHeads } from "../index";
import { wedgeHitsExclusion } from "../wedge";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dirname, "../../../../../prisma/seed-data/catalog-items.json"), "utf8")
) as CatalogItemData[];

const scale = {
  pointA: { x: 0, y: 0 },
  pointB: { x: 10, y: 0 },
  realWorldFeet: 10,
};

function squareVertices(sizeFt: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: sizeFt, y: 0 },
    { x: sizeFt, y: sizeFt },
    { x: 0, y: sizeFt },
  ];
}

function rectangleVertices(widthFt: number, heightFt: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: widthFt, y: 0 },
    { x: widthFt, y: heightFt },
    { x: 0, y: heightFt },
  ];
}

function triangleVertices(baseFt: number, heightFt: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: baseFt, y: 0 },
    { x: baseFt / 2, y: heightFt },
  ];
}

function baseHydrozone(
  id: string,
  vertices: Point[],
  overrides: Partial<HydrozonePolygon> = {}
): HydrozonePolygon {
  return {
    id,
    name: id,
    vertices,
    hydrozoneType: "TURF",
    sunExposure: "FULL_SUN",
    slopePercent: 0,
    soilType: "LOAM",
    waterPriority: 3,
    headPreference: "MP_ROTATOR",
    ...overrides,
  };
}

describe("placeHeads head-to-head", () => {
  it("places 4 corner heads on a 30×30 ft square with ≥85% overlap", () => {
    const vertices = squareVertices(30);
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-square", vertices),
      zoneId: "zone-1",
      catalog,
      scale,
      exclusionZones: [],
      pressurePsi: 65,
    });

    assert.ok(result.heads.length >= 4, `expected at least 4 heads, got ${result.heads.length}`);
    const cornerHeads = result.heads.filter((h) => h.arcDegrees <= 100);
    assert.ok(cornerHeads.length >= 4, "expected corner arcs near 90°");
    assert.ok((result.overlapPercent ?? 0) >= 85, `overlap ${result.overlapPercent}%`);
    assert.equal(result.pattern, "square");
  });

  it("places heads on a 25×36 ft rectangle", () => {
    const vertices = rectangleVertices(25, 36);
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-rect", vertices),
      zoneId: "zone-1",
      catalog,
      scale,
      exclusionZones: [],
      pressurePsi: 65,
    });

    assert.ok(result.heads.length >= 4);
    assert.ok((result.overlapPercent ?? 0) >= 50);
  });

  it("uses triangular pattern for a triangle hydrozone", () => {
    const vertices = triangleVertices(40, 35);
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-tri", vertices, { spacingPattern: "triangular" }),
      zoneId: "zone-1",
      catalog,
      scale,
      exclusionZones: [],
      pressurePsi: 65,
    });

    assert.equal(result.pattern, "triangular");
    assert.ok(result.heads.length >= 3);
  });

  it("avoids wedge overspray into exclusion zones", () => {
    const vertices = squareVertices(30);
    const exclusion = {
      id: "ex-1",
      name: "Building",
      vertices: [
        { x: 28, y: 10 },
        { x: 35, y: 10 },
        { x: 35, y: 20 },
        { x: 28, y: 20 },
      ],
      exclusionType: "BUILDING" as const,
    };

    const result = placeHeads({
      hydrozone: baseHydrozone("hz-excl", vertices),
      zoneId: "zone-1",
      catalog,
      scale,
      exclusionZones: [exclusion],
      pressurePsi: 65,
    });

    for (const head of result.heads) {
      const wedge = {
        position: head.position,
        arcDegrees: head.arcDegrees,
        radiusFeet: head.radiusFeet,
        rotationDegrees: head.rotationDegrees,
      };
      const hits = wedgeHitsExclusion(wedge, [exclusion], 1);
      assert.equal(hits, false, `head ${head.id} wedge hits exclusion`);
    }
  });
});

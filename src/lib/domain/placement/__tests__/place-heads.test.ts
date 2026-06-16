import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { CatalogItemData, HydrozonePolygon, Point } from "../../types";
import { analyzePolygon } from "../geometry";
import { planEdgeRuns } from "../edge-spacing";
import { placeHeads } from "../index";
import { wedgeHitsExclusion, wedgeStartDeg, wedgeEndDeg, isPointInWedge } from "../wedge";
import { bearingDeg, polygonCentroid } from "../geometry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dirname, "../../../../../prisma/seed-data/catalog-items.json"), "utf8")
) as CatalogItemData[];

const scale = {
  pointA: { x: 0, y: 0 },
  pointB: { x: 10, y: 0 },
  realWorldFeet: 10,
};

function rectangleVertices(widthFt: number, heightFt: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: widthFt, y: 0 },
    { x: widthFt, y: heightFt },
    { x: 0, y: heightFt },
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

function headsOnEdge(heads: ReturnType<typeof placeHeads>["heads"], y: number, tolerance = 1): typeof heads {
  return heads.filter((h) => Math.abs(h.position.y - y) < tolerance);
}

function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > 180) d = 360 - d;
  return d;
}

function inwardSamplePoint(head: { position: Point; rotationDegrees: number; arcDegrees: number; radiusFeet: number }, ppf: number): Point {
  const rad = (head.rotationDegrees * Math.PI) / 180;
  const dist = head.radiusFeet * ppf * 0.5;
  return {
    x: head.position.x + Math.cos(rad) * dist,
    y: head.position.y + Math.sin(rad) * dist,
  };
}

describe("edge-spacing", () => {
  it("plans even segments for a 55 ft edge with 30 ft throw", () => {
    const vertices = rectangleVertices(55, 30);
    const analysis = analyzePolygon(vertices, 1);
    const runs = planEdgeRuns(analysis, 30);
    const bottom = runs.find((r) => r.edgeIndex === 0);
    assert.ok(bottom);
    assert.equal(bottom.spanCount, 2);
    assert.equal(bottom.spacingFt, 27.5);
    assert.deepEqual(bottom.interiorTs, [0.5]);
  });
});

describe("placeHeads head-to-head spacing", () => {
  it("places 3 heads on a 55×30 ft long edge with even ~27.5 ft spacing", () => {
    const vertices = rectangleVertices(55, 30);
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-55x30", vertices),
      zoneId: "zone-1",
      catalog,
      scale,
      exclusionZones: [],
      pressurePsi: 65,
    });

    const bottomRow = headsOnEdge(result.heads, 0);
    assert.ok(bottomRow.length >= 3, `expected 3+ heads on bottom edge, got ${bottomRow.length}`);

    const xs = bottomRow.map((h) => h.position.x).sort((a, b) => a - b);
    if (xs.length >= 3) {
      const seg1 = xs[1] - xs[0];
      const seg2 = xs[2] - xs[1];
      assert.ok(Math.abs(seg1 - 27.5) / 27.5 <= 0.12, `segment1 ${seg1}`);
      assert.ok(Math.abs(seg2 - 27.5) / 27.5 <= 0.12, `segment2 ${seg2}`);
    }
  });

  it("orients 180° center edge head arc edges toward corner heads", () => {
    const vertices = rectangleVertices(55, 30);
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-aim", vertices),
      zoneId: "zone-1",
      catalog,
      scale,
      exclusionZones: [],
      pressurePsi: 65,
    });

    const bottomRow = headsOnEdge(result.heads, 0);
    const center = bottomRow.find((h) => h.position.x > 20 && h.position.x < 35);
    assert.ok(center, "expected center head on bottom edge");
    assert.ok(center.arcDegrees >= 170 && center.arcDegrees <= 190);

    const leftCorner = bottomRow.find((h) => h.position.x < 1);
    const rightCorner = bottomRow.find((h) => h.position.x > 54);
    assert.ok(leftCorner && rightCorner);

    const start = wedgeStartDeg(center);
    const end = wedgeEndDeg(center);
    const toLeft = bearingDeg(center.position, leftCorner.position);
    const toRight = bearingDeg(center.position, rightCorner.position);

    assert.ok(angleDiff(start, toLeft) < 15 || angleDiff(end, toLeft) < 15);
    assert.ok(angleDiff(start, toRight) < 15 || angleDiff(end, toRight) < 15);
  });

  it("orients top and bottom edge center heads 180° inward with pixel scale", () => {
    const ppf = 100 / 55;
    const w = 55 * ppf;
    const h = 30 * ppf;
    const vertices = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
    const pixelScale = {
      pointA: { x: 0, y: 0 },
      pointB: { x: 100, y: 0 },
      realWorldFeet: 55,
    };
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-pixel", vertices),
      zoneId: "zone-1",
      catalog,
      scale: pixelScale,
      exclusionZones: [],
      pressurePsi: 65,
    });

    const centroid = polygonCentroid(vertices);
    const topCenter = result.heads.find(
      (head) => Math.abs(head.position.y) < 1 && head.position.x > 10 && head.position.x < w - 10
    );
    const bottomCenter = result.heads.find(
      (head) => Math.abs(head.position.y - h) < 1 && head.position.x > 10 && head.position.x < w - 10
    );
    assert.ok(topCenter, "expected top edge center head");
    assert.ok(bottomCenter, "expected bottom edge center head");
    assert.ok(topCenter.arcDegrees >= 170 && topCenter.arcDegrees <= 190);
    assert.ok(bottomCenter.arcDegrees >= 170 && bottomCenter.arcDegrees <= 190);

    for (const head of [topCenter, bottomCenter]) {
      const sample = inwardSamplePoint(head, ppf);
      assert.ok(
        isPointInWedge(head, sample, ppf),
        "arc center should lie inside the wedge"
      );
      const toCentroid = bearingDeg(head.position, centroid);
      assert.ok(
        angleDiff(head.rotationDegrees, toCentroid) < 45,
        `head should spray toward interior, rot=${head.rotationDegrees} centroid=${toCentroid.toFixed(0)}`
      );
    }
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
      assert.equal(wedgeHitsExclusion(wedge, [exclusion], 1), false);
    }
  });

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

    assert.ok(result.heads.length >= 4);
    assert.ok((result.overlapPercent ?? 0) >= 85);
  });
});

function squareVertices(sizeFt: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: sizeFt, y: 0 },
    { x: sizeFt, y: sizeFt },
    { x: 0, y: sizeFt },
  ];
}

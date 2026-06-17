import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { CatalogItemData, HydrozonePolygon, Point } from "../../types";
import { analyzePolygon } from "../geometry";
import { planEdgeRuns } from "../edge-spacing";
import { placeHeads } from "../index";
import { PGP_ADJ_HEAD_BODY_ID } from "../pgp-adj-placement";
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
    headPreference: "ROTOR",
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
  it("uses PGP-ADJ rotors with arc-based blue nozzles", () => {
    const vertices = rectangleVertices(55, 30);
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-pgp", vertices),
      zoneId: "zone-1",
      catalog,
      scale,
      exclusionZones: [],
      pressurePsi: 65,
    });

    assert.ok(result.heads.length >= 4);
    assert.ok(result.heads.every((h) => h.headBodyId === PGP_ADJ_HEAD_BODY_ID));
    const corner = result.heads.find((h) => h.arcDegrees <= 100);
    const edge = result.heads.find((h) => h.arcDegrees >= 170 && h.arcDegrees <= 190);
    if (corner) {
      assert.equal(corner.catalogItemId, "noz_pgp_adj_blue_1_5");
    }
    if (edge) {
      assert.equal(edge.catalogItemId, "noz_pgp_adj_blue_3_0");
    }
  });

  it("places 3 heads on a 70×30 ft long edge with even ~35 ft spacing", () => {
    const vertices = rectangleVertices(70, 30);
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-70x30", vertices),
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
      assert.ok(Math.abs(seg1 - 35) / 35 <= 0.12, `segment1 ${seg1}`);
      assert.ok(Math.abs(seg2 - 35) / 35 <= 0.12, `segment2 ${seg2}`);
    }
  });

  it("orients 180° center edge head arc edges toward corner heads", () => {
    const vertices = rectangleVertices(70, 30);
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-aim", vertices),
      zoneId: "zone-1",
      catalog,
      scale,
      exclusionZones: [],
      pressurePsi: 65,
    });

    const bottomRow = headsOnEdge(result.heads, 0);
    const center = bottomRow.find((h) => h.position.x > 25 && h.position.x < 45);
    assert.ok(center, "expected center head on bottom edge");
    assert.ok(center.arcDegrees >= 170 && center.arcDegrees <= 190);

    const leftCorner = bottomRow.find((h) => h.position.x < 1);
    const rightCorner = bottomRow.find((h) => h.position.x > 69);
    assert.ok(leftCorner && rightCorner);

    const start = wedgeStartDeg(center);
    const end = wedgeEndDeg(center);
    const toLeft = bearingDeg(center.position, leftCorner.position);
    const toRight = bearingDeg(center.position, rightCorner.position);

    assert.ok(angleDiff(start, toLeft) < 15 || angleDiff(end, toLeft) < 15);
    assert.ok(angleDiff(start, toRight) < 15 || angleDiff(end, toRight) < 15);
  });

  it("orients top and bottom edge center heads 180° inward with pixel scale", () => {
    const ppf = 100 / 70;
    const w = 70 * ppf;
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
      realWorldFeet: 70,
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

  it("orients reflex notch corner heads toward lawn interior", () => {
    const ppf = 100 / 55;
    const vertices = notchVerticesCw(ppf);
    const pixelScale = {
      pointA: { x: 0, y: 0 },
      pointB: { x: 100, y: 0 },
      realWorldFeet: 55,
    };
    const centroid = polygonCentroid(vertices);
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-notch", vertices),
      zoneId: "zone-1",
      catalog,
      scale: pixelScale,
      exclusionZones: [],
      pressurePsi: 65,
    });

    const notchCorners = result.heads.filter((h) => {
      const nd = 8 * ppf;
      return Math.abs(h.position.y - nd) < 2;
    });
    assert.ok(notchCorners.length >= 2, "expected heads at notch inner corners");

    for (const head of notchCorners) {
      assert.ok(
        head.arcDegrees >= 180,
        `reflex corner should have wide arc, got ${head.arcDegrees}°`
      );
      const toCentroid = bearingDeg(head.position, centroid);
      assert.ok(
        angleDiff(head.rotationDegrees, toCentroid) < 45,
        `notch corner should spray toward interior, rot=${head.rotationDegrees.toFixed(0)} centroid=${toCentroid.toFixed(0)}`
      );
    }
  });

  it("does not place edge heads too close to corner vertices", () => {
    const ppf = 100 / 55;
    const vertices = notchVerticesCw(ppf);
    const pixelScale = {
      pointA: { x: 0, y: 0 },
      pointB: { x: 100, y: 0 },
      realWorldFeet: 55,
    };
    const vertexKeys = new Set(
      vertices.map((v) => `${Math.round(v.x * 1000)}:${Math.round(v.y * 1000)}`)
    );
    const result = placeHeads({
      hydrozone: baseHydrozone("hz-dedupe", vertices),
      zoneId: "zone-1",
      catalog,
      scale: pixelScale,
      exclusionZones: [],
      pressurePsi: 65,
    });

    const minSepPx = (result.radiusFeet ?? 20) * ppf * 0.45;
    const edgeHeads = result.heads.filter(
      (h) => !vertexKeys.has(`${Math.round(h.position.x * 1000)}:${Math.round(h.position.y * 1000)}`)
    );

    for (const edgeHead of edgeHeads) {
      for (const vertex of vertices) {
        const d = Math.hypot(edgeHead.position.x - vertex.x, edgeHead.position.y - vertex.y);
        assert.ok(
          d >= minSepPx,
          `edge head at (${edgeHead.position.x.toFixed(1)},${edgeHead.position.y.toFixed(1)}) is ${d.toFixed(1)}px from a corner`
        );
      }
    }
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

function notchVerticesCw(ppf: number): Point[] {
  const w = 55 * ppf;
  const h = 30 * ppf;
  const nw = 12 * ppf;
  const nd = 8 * ppf;
  const nx = (w - nw) / 2;
  return [
    { x: 0, y: 0 },
    { x: 0, y: h },
    { x: w, y: h },
    { x: w, y: 0 },
    { x: nx + nw, y: 0 },
    { x: nx + nw, y: nd },
    { x: nx, y: nd },
    { x: nx, y: 0 },
  ];
}

import assert from "node:assert/strict";
/**
 * Manual QA checklist (/training):
 * 1. Generate loads a synthetic polygon with baseline heads and heatmap.
 * 2. Select/move/add/delete heads; arc, radius, rotation sliders update coverage.
 * 3. Score panel shows baseline vs corrected DU_LQ and improvement score.
 * 4. Approve saves to DB; Next/Generate loads a new example.
 * 5. Export downloads JSONL with full payload per approved row.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { generateTrainingPolygon, buildCanonicalTrainingPolygon } from "../polygon-generator";
import { computeTrainingStagePaddingPx, trainingStageSizePx } from "../stage-layout";
import { applyOrganicEdges, circularLawn } from "../organic-edges";
import { runPlacementOnPolygon } from "../placement-adapter";
import { evaluateDesign } from "../../simulation/scoring";
import { precipValueAtPoint } from "../../simulation/sample-grid";
import { DEFAULT_RADIAL_CURVE } from "../../simulation/radial-curve";
import {
  pointAlongEdge,
  pointInPolygon,
  polygonBounds,
  polygonCentroid,
  projectPointOnEdge,
} from "../../placement/geometry";
import type { CatalogItemData, Point } from "../../types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dirname, "../../../../../prisma/seed-data/catalog-items.json"), "utf8")
) as CatalogItemData[];

function onLawnBoundary(point: Point, lawn: Point[], eps = 0.08): boolean {
  for (let i = 0; i < lawn.length; i++) {
    const a = lawn[i]!;
    const b = lawn[(i + 1) % lawn.length]!;
    const t = projectPointOnEdge(a, b, point);
    if (t < -0.02 || t > 1.02) continue;
    const proj = pointAlongEdge(a, b, Math.max(0, Math.min(1, t)));
    if (Math.hypot(point.x - proj.x, point.y - proj.y) <= eps) return true;
  }
  return false;
}

describe("polygon-generator", () => {
  it("generates valid CCW polygons with minimum area", () => {
    const { verticesFt, metadata } = generateTrainingPolygon({ seed: 42, shapeClass: "rectangle" });
    assert.ok(verticesFt.length >= 4);
    assert.ok(metadata.areaSqFt >= 80);
    const mid = {
      x: verticesFt.reduce((s, v) => s + v.x, 0) / verticesFt.length,
      y: verticesFt.reduce((s, v) => s + v.y, 0) / verticesFt.length,
    };
    assert.ok(pointInPolygon(mid, verticesFt));
  });

  it("includes rounded side lengths for each edge", () => {
    const { verticesFt, metadata } = generateTrainingPolygon({ seed: 42, shapeClass: "rectangle" });
    assert.equal(metadata.sideLengthsFt.length, verticesFt.length);
    for (const len of metadata.sideLengthsFt) {
      assert.ok(len > 0);
      assert.equal(len, Math.round(len * 10) / 10);
    }
  });

  it("sometimes adds curved or wavy edges with more vertices than the canonical shape", () => {
    let foundOrganic = false;
    for (let seed = 0; seed < 80; seed++) {
      const canonical = buildCanonicalTrainingPolygon("back_yard", seed);
      const generated = generateTrainingPolygon({ seed, shapeClass: "back_yard" });
      if (generated.verticesFt.length > canonical.length) {
        foundOrganic = true;
        break;
      }
    }
    assert.ok(foundOrganic, "expected at least one seed with organic edge discretization");
  });

  it("organic edge pass keeps simple valid polygons", () => {
    const base = buildCanonicalTrainingPolygon("rectangle", 12);
    const rng = () => 0.1;
    const organic = applyOrganicEdges(base, rng, { probability: 1 });
    assert.ok(organic.length > base.length);
    const poly = generateTrainingPolygon({ seed: 1200, shapeClass: "rectangle" });
    assert.ok(poly.metadata.areaSqFt >= 80);
    assert.ok(poly.verticesFt.length >= 4);
  });

  it("irregular variants can be circular lawns", () => {
    const rng = () => 0.5;
    const randRange = (_rng: () => number, min: number, max: number) => (min + max) / 2;
    const randInt = (_rng: () => number, min: number, max: number) => Math.floor((min + max) / 2);
    const vertices = circularLawn(rng, randRange, randInt);
    assert.ok(vertices.length >= 20);
    const lengths = vertices.map((v, i) => {
      const next = vertices[(i + 1) % vertices.length]!;
      return Math.hypot(next.x - v.x, next.y - v.y);
    });
    const mean = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    assert.ok(lengths.every((len) => Math.abs(len - mean) / mean < 0.02));
    const poly = generateTrainingPolygon({ seed: 4242, shapeClass: "irregular" });
    assert.ok(poly.metadata.areaSqFt >= 80);
  });

  it("is reproducible with the same seed", () => {
    const a = generateTrainingPolygon({ seed: 999, shapeClass: "concave" });
    const b = generateTrainingPolygon({ seed: 999, shapeClass: "concave" });
    assert.deepEqual(a.verticesFt, b.verticesFt);
    assert.equal(a.metadata.rotationDeg, b.metadata.rotationDeg);
  });

  it("irregular shapes have more vertices than L-shapes and differ structurally", () => {
    const l = generateTrainingPolygon({ seed: 100, shapeClass: "l_shape" });
    const irregular = generateTrainingPolygon({ seed: 100, shapeClass: "irregular" });
    assert.ok(irregular.verticesFt.length >= 8);
    assert.notDeepEqual(
      irregular.verticesFt.map((v) => [Math.round(v.x), Math.round(v.y)]),
      l.verticesFt.map((v) => [Math.round(v.x), Math.round(v.y)])
    );
  });

  it("applies seeded rotation so the same shape class varies in orientation", () => {
    const a = generateTrainingPolygon({ seed: 55, shapeClass: "rectangle" });
    const b = generateTrainingPolygon({ seed: 56, shapeClass: "rectangle" });
    assert.ok(a.metadata.rotationDeg >= 0 && a.metadata.rotationDeg <= 360);
    assert.notDeepEqual(a.verticesFt, b.verticesFt);
  });

  it("may attach exclusion zones that share borders without overlapping the lawn", () => {
    let withExcl = 0;
    let withoutExcl = 0;
    for (let seed = 0; seed < 200; seed++) {
      const poly = generateTrainingPolygon({ seed, shapeClass: "back_yard" });
      if (poly.exclusionZonesFt.length > 0) {
        withExcl++;
        assert.equal(poly.metadata.hasExclusions, true);
        for (const zone of poly.exclusionZonesFt) {
          const mid = polygonCentroid(zone.vertices);
          assert.ok(
            !pointInPolygon(mid, poly.verticesFt) || onLawnBoundary(mid, poly.verticesFt),
            "exclusion interior must not overlap lawn"
          );
          for (const v of zone.vertices) {
            assert.ok(
              !pointInPolygon(v, poly.verticesFt) || onLawnBoundary(v, poly.verticesFt),
              "exclusion vertices must not lie inside lawn"
            );
          }
          const boundaryVerts = zone.vertices.filter((v) => onLawnBoundary(v, poly.verticesFt));
          assert.ok(boundaryVerts.length >= 2, "exclusion must share a border with lawn");
        }
        const lawnBounds = polygonBounds(poly.verticesFt);
        const sceneBounds = polygonBounds([
          ...poly.verticesFt,
          ...poly.exclusionZonesFt.flatMap((z) => z.vertices),
        ]);
        assert.ok(sceneBounds.maxX - sceneBounds.minX >= lawnBounds.maxX - lawnBounds.minX);
      } else {
        withoutExcl++;
        assert.equal(poly.metadata.hasExclusions, false);
      }
    }
    assert.ok(withExcl > 0, "expected some seeds with exclusions");
    assert.ok(withoutExcl > 0, "expected some seeds without exclusions");
  });

  it("includes exclusions in reproducible output for the same seed", () => {
    const a = generateTrainingPolygon({ seed: 4242, shapeClass: "rectangle" });
    const b = generateTrainingPolygon({ seed: 4242, shapeClass: "rectangle" });
    assert.deepEqual(a.exclusionZonesFt, b.exclusionZonesFt);
  });
});

describe("stage-layout", () => {
  it("reserves enough padding for corner head spray arcs", () => {
    const heads = [
      {
        id: "h1",
        positionFt: { x: 0, y: 0 },
        radiusFeet: 30,
        arcDegrees: 90,
        rotationDegrees: 0,
        wedgeStartDeg: 0,
        wedgeEndDeg: 90,
        catalogItemId: "x",
      },
      {
        id: "h2",
        positionFt: { x: 45, y: 30 },
        radiusFeet: 30,
        arcDegrees: 90,
        rotationDegrees: 180,
        wedgeStartDeg: 180,
        wedgeEndDeg: 270,
        catalogItemId: "x",
      },
    ];
    const pad = computeTrainingStagePaddingPx(45, 30, heads, 10);
    assert.ok(pad >= 30 * 10, "padding must cover 30 ft throw radius");
    const size = trainingStageSizePx(45, 30, heads, 10);
    assert.equal(size.widthPx, 45 * 10 + pad * 2);
    assert.equal(size.heightPx, 30 * 10 + pad * 2);
  });
});

describe("placement-adapter", () => {
  it("places heads on a generated rectangle", () => {
    const poly = generateTrainingPolygon({ seed: 1, shapeClass: "rectangle" });
    const result = runPlacementOnPolygon(poly, catalog);
    assert.ok(result.heads.length >= 4);
    assert.ok(result.heads.every((h) => h.wedgeStartDeg >= 0 && h.wedgeEndDeg >= 0));
  });
});

describe("training pipeline integration", () => {
  it("generate → place → simulate → score", () => {
    const poly = generateTrainingPolygon({ seed: 7, shapeClass: "back_yard" });
    const placed = runPlacementOnPolygon(poly, catalog);
    const { scores, grid, samplePoints, precipValues } = evaluateDesign(poly.verticesFt, placed.heads);
    assert.ok(scores.sampleCount > 0);
    assert.ok(scores.headCount === placed.heads.length);
    assert.equal(grid.values.length, grid.cols * grid.rows);
    assert.equal(scores.sampleCount, samplePoints.length);
    for (let i = 0; i < samplePoints.length; i++) {
      assert.equal(precipValueAtPoint(grid, samplePoints[i]!), precipValues[i]);
    }
    assert.ok(scores.duLq >= 0 && scores.duLq <= 1.5);
  });
});

describe("radial-curve", () => {
  it("returns expected band strengths", () => {
    assert.equal(DEFAULT_RADIAL_CURVE.strengthAtRatio(0.1), 0.45);
    assert.equal(DEFAULT_RADIAL_CURVE.strengthAtRatio(0.35), 0.75);
    assert.equal(DEFAULT_RADIAL_CURVE.strengthAtRatio(0.7), 1.0);
    assert.equal(DEFAULT_RADIAL_CURVE.strengthAtRatio(0.95), 0.8);
    assert.equal(DEFAULT_RADIAL_CURVE.strengthAtRatio(1.1), 0);
  });
});

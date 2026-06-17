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
import { generateTrainingPolygon } from "../polygon-generator";
import { runPlacementOnPolygon } from "../placement-adapter";
import { evaluateDesign } from "../../simulation/scoring";
import { precipValueAtPoint } from "../../simulation/sample-grid";
import { DEFAULT_RADIAL_CURVE } from "../../simulation/radial-curve";
import { pointInPolygon } from "../../placement/geometry";
import type { CatalogItemData } from "../../types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dirname, "../../../../../prisma/seed-data/catalog-items.json"), "utf8")
) as CatalogItemData[];

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

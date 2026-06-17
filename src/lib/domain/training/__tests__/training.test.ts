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

  it("is reproducible with the same seed", () => {
    const a = generateTrainingPolygon({ seed: 999, shapeClass: "concave" });
    const b = generateTrainingPolygon({ seed: 999, shapeClass: "concave" });
    assert.deepEqual(a.verticesFt, b.verticesFt);
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
    const { scores, grid } = evaluateDesign(poly.verticesFt, placed.heads);
    assert.ok(scores.sampleCount > 0);
    assert.ok(scores.headCount === placed.heads.length);
    assert.ok(grid.values.length === scores.sampleCount);
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

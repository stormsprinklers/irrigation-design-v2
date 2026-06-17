import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateTrainingPolygon } from "../../training/polygon-generator";
import { evaluateDesign } from "../scoring";
import {
  buildPrecipGrid,
  gridIndexForPoint,
  precipValueAtPoint,
  samplePointsInPolygonFeet,
} from "../sample-grid";
import { precipAtPoint } from "../precip-simulator";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPlacementOnPolygon } from "../../training/placement-adapter";
import type { CatalogItemData } from "../../types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dirname, "../../../../../prisma/seed-data/catalog-items.json"), "utf8")
) as CatalogItemData[];

describe("buildPrecipGrid", () => {
  it("maps sample values to dense row-major grid cells inside the polygon", () => {
    const poly = generateTrainingPolygon({ seed: 12, shapeClass: "l_shape" });
    const placed = runPlacementOnPolygon(poly, catalog);
    const stepFt = 1.5;
    const samplePoints = samplePointsInPolygonFeet(poly.verticesFt, stepFt);
    const values = samplePoints.map((p) => precipAtPoint(p, placed.heads));

    const grid = buildPrecipGrid(poly.verticesFt, samplePoints, values, stepFt);
    assert.equal(grid.values.length, grid.cols * grid.rows);
    assert.equal(samplePoints.length, values.length);

    for (let i = 0; i < samplePoints.length; i++) {
      const idx = gridIndexForPoint(grid, samplePoints[i]!);
      assert.ok(idx >= 0);
      assert.equal(grid.values[idx], values[i]);
      assert.equal(precipValueAtPoint(grid, samplePoints[i]!), values[i]);
    }
  });

  it("evaluateDesign grid aligns with simulated sample points", () => {
    const poly = generateTrainingPolygon({ seed: 3, shapeClass: "rectangle" });
    const placed = runPlacementOnPolygon(poly, catalog);
    const { grid, samplePoints, precipValues } = evaluateDesign(poly.verticesFt, placed.heads);

    assert.equal(grid.values.length, grid.cols * grid.rows);
    for (let i = 0; i < samplePoints.length; i++) {
      assert.equal(precipValueAtPoint(grid, samplePoints[i]!), precipValues[i]);
    }
  });
});

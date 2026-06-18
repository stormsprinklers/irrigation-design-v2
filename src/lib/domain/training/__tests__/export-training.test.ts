import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSplitManifest,
  seedSplitBucket,
  rowPassesExportFilters,
  type TrainingExportRow,
} from "../export-training";
import type { TrainingExamplePayload } from "../types";

function minimalPayload(seed: number): TrainingExamplePayload {
  return {
    algorithmVersion: "placement@test",
    polygonVerticesFt: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    polygonMetadata: {
      shapeClass: "rectangle",
      seed,
      widthFt: 10,
      heightFt: 10,
      areaSqFt: 100,
      vertexCount: 4,
      sideLengthsFt: [10, 10, 10, 10],
      hasExclusions: false,
      rotationDeg: 0,
    },
    placementContext: {
      headPreference: "ROTOR",
      pressurePsi: 65,
      catalogItemIds: ["nozzle-1"],
    },
    algorithmOutput: [],
    approvedOutput: [],
    originalScores: {
      coveragePercent: 0,
      avgPrecip: 0,
      minPrecip: 0,
      maxPrecip: 0,
      duLq: 0,
      drySpotCount: 0,
      wetSpotCount: 0,
      headToHeadViolations: 0,
      oversprayEstimatePercent: 0,
      exclusionOversprayPercent: 0,
      headCount: 0,
      sampleCount: 0,
    },
    approvedScores: {
      coveragePercent: 0,
      avgPrecip: 0,
      minPrecip: 0,
      maxPrecip: 0,
      duLq: 0,
      drySpotCount: 0,
      wetSpotCount: 0,
      headToHeadViolations: 0,
      oversprayEstimatePercent: 0,
      exclusionOversprayPercent: 0,
      headCount: 0,
      sampleCount: 0,
    },
    originalPrecipGrid: {
      originFt: { x: 0, y: 0 },
      stepFt: 1,
      cols: 1,
      rows: 1,
      values: [0],
    },
    approvedPrecipGrid: {
      originFt: { x: 0, y: 0 },
      stepFt: 1,
      cols: 1,
      rows: 1,
      values: [0],
    },
    improvementScore: 0,
    validForTraining: true,
  };
}

function row(id: string, seed: number, valid = true): TrainingExportRow {
  return {
    id,
    organizationId: "org",
    createdById: "user",
    status: "APPROVED",
    algorithmVersion: "placement@v1",
    validForTraining: valid,
    needsRescore: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    approvedAt: "2026-01-01T00:00:00.000Z",
    payload: minimalPayload(seed),
  };
}

describe("export-training", () => {
  it("seedSplitBucket assigns deterministic buckets", () => {
    assert.equal(seedSplitBucket(0), "train");
    assert.equal(seedSplitBucket(69), "train");
    assert.equal(seedSplitBucket(70), "val");
    assert.equal(seedSplitBucket(84), "val");
    assert.equal(seedSplitBucket(85), "test");
  });

  it("rowPassesExportFilters respects flags", () => {
    const r = row("a", 1);
    assert.equal(rowPassesExportFilters(r, { validForTrainingOnly: true }), true);
    assert.equal(
      rowPassesExportFilters(row("b", 2, false), { validForTrainingOnly: true }),
      false
    );
    assert.equal(
      rowPassesExportFilters(r, { algorithmVersion: "placement@v1" }),
      true
    );
    assert.equal(
      rowPassesExportFilters(r, { algorithmVersion: "other" }),
      false
    );
  });

  it("buildSplitManifest groups by seed bucket", () => {
    const manifest = buildSplitManifest([
      {
        schemaVersion: 2,
        id: "a",
        algorithmVersion: "v1",
        shapeClass: "rectangle",
        seed: 0,
        polygonVerticesFt: [],
        polygonMetadata: minimalPayload(0).polygonMetadata,
        exclusionZonesFt: [],
        placementContext: minimalPayload(0).placementContext,
        algorithmOutput: [],
        approvedOutput: [],
        editLog: undefined,
        improvementScore: 0,
        validForTraining: true,
        approvedAt: null,
      },
      {
        schemaVersion: 2,
        id: "b",
        algorithmVersion: "v1",
        shapeClass: "rectangle",
        seed: 85,
        polygonVerticesFt: [],
        polygonMetadata: minimalPayload(85).polygonMetadata,
        exclusionZonesFt: [],
        placementContext: minimalPayload(85).placementContext,
        algorithmOutput: [],
        approvedOutput: [],
        editLog: undefined,
        improvementScore: 0,
        validForTraining: true,
        approvedAt: null,
      },
    ]);
    assert.ok(manifest.splits.train.includes("a"));
    assert.ok(manifest.splits.test.includes("b"));
  });
});

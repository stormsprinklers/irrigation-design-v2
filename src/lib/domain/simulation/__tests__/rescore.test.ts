import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CURRENT_DISTRIBUTION_CURVE_VERSION } from "../radial-curve";
import { rescoreTrainingExamplePayload } from "../../training/rescore-example";
import {
  annotateTrainingPayload,
  payloadNeedsRescore,
} from "../../training/training-payload";
import type { TrainingExamplePayload } from "../../training/types";

function minimalPayload(
  overrides: Partial<TrainingExamplePayload> = {}
): TrainingExamplePayload {
  const lawn = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 20 },
    { x: 0, y: 20 },
  ];
  const head = {
    id: "h1",
    positionFt: { x: 0, y: 0 },
    radiusFeet: 18,
    arcDegrees: 90,
    rotationDegrees: 45,
    wedgeStartDeg: 0,
    wedgeEndDeg: 90,
    catalogItemId: "test",
    precipInPerHr: 1,
  };
  return {
    algorithmVersion: "placement@test",
    polygonVerticesFt: lawn,
    polygonMetadata: {
      shapeClass: "rectangle",
      seed: 1,
      widthFt: 30,
      heightFt: 20,
      areaSqFt: 600,
      vertexCount: 4,
      sideLengthsFt: [30, 20, 30, 20],
      hasExclusions: false,
      rotationDeg: 0,
    },
    placementContext: {
      headPreference: "ROTOR",
      pressurePsi: 65,
      catalogItemIds: ["test"],
    },
    algorithmOutput: [head],
    approvedOutput: [head],
    originalScores: {
      coveragePercent: 50,
      avgPrecip: 1,
      minPrecip: 0,
      maxPrecip: 2,
      duLq: 0.5,
      drySpotCount: 0,
      wetSpotCount: 0,
      headToHeadViolations: 0,
      oversprayEstimatePercent: 0,
      exclusionOversprayPercent: 0,
      headCount: 1,
      sampleCount: 10,
    },
    approvedScores: {
      coveragePercent: 50,
      avgPrecip: 1,
      minPrecip: 0,
      maxPrecip: 2,
      duLq: 0.5,
      drySpotCount: 0,
      wetSpotCount: 0,
      headToHeadViolations: 0,
      oversprayEstimatePercent: 0,
      exclusionOversprayPercent: 0,
      headCount: 1,
      sampleCount: 10,
    },
    originalPrecipGrid: {
      originFt: { x: 0, y: 0 },
      stepFt: 1.5,
      cols: 1,
      rows: 1,
      values: [1],
    },
    approvedPrecipGrid: {
      originFt: { x: 0, y: 0 },
      stepFt: 1.5,
      cols: 1,
      rows: 1,
      values: [1],
    },
    improvementScore: 0,
    ...overrides,
  };
}

describe("annotateTrainingPayload", () => {
  it("marks legacy payloads as needsRescore and not validForTraining", () => {
    const annotated = annotateTrainingPayload(minimalPayload());
    assert.equal(annotated.needsRescore, true);
    assert.equal(annotated.validForTraining, false);
    assert.equal(annotated.distributionCurveVersion, "legacy_bell_v0");
    assert.ok(payloadNeedsRescore(minimalPayload()));
  });

  it("keeps current-curve payloads training-ready", () => {
    const payload = minimalPayload({
      distributionCurveVersion: CURRENT_DISTRIBUTION_CURVE_VERSION,
      validForTraining: true,
      needsRescore: false,
    });
    const annotated = annotateTrainingPayload(payload);
    assert.equal(annotated.needsRescore, false);
    assert.equal(annotated.validForTraining, true);
    assert.ok(!payloadNeedsRescore(payload));
  });
});

describe("rescoreTrainingExamplePayload", () => {
  it("updates scores and flags without changing head layouts", () => {
    const payload = minimalPayload();
    const rescored = rescoreTrainingExamplePayload(payload);

    assert.deepEqual(rescored.algorithmOutput, payload.algorithmOutput);
    assert.deepEqual(rescored.approvedOutput, payload.approvedOutput);
    assert.equal(rescored.distributionCurveVersion, CURRENT_DISTRIBUTION_CURVE_VERSION);
    assert.equal(rescored.validForTraining, true);
    assert.equal(rescored.needsRescore, false);
    assert.ok(rescored.originalScores.sampleCount > 0);
    assert.equal(
      rescored.originalPrecipGrid.values.length,
      rescored.originalPrecipGrid.cols * rescored.originalPrecipGrid.rows
    );
  });
});

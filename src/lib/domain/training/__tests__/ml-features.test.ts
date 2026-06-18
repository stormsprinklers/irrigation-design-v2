import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMlFeatureTensors,
  ML_FEATURE_SPEC_VERSION,
  ML_MAX_HEADS,
  ML_MAX_VERTICES,
} from "../ml-features";

describe("ml-features", () => {
  it("builds tensors with expected dimensions", () => {
    const tensors = buildMlFeatureTensors({
      polygonVerticesFt: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 0, y: 10 },
      ],
      shapeClass: "rectangle",
      baselineHeads: [
        {
          id: "h1",
          positionFt: { x: 5, y: 5 },
          radiusFeet: 18,
          arcDegrees: 360,
          rotationDegrees: 0,
          wedgeStartDeg: 0,
          wedgeEndDeg: 360,
          catalogItemId: "nozzle-a",
        },
      ],
      placementContext: {
        headPreference: "ROTOR",
        pressurePsi: 65,
        catalogItemIds: ["nozzle-a"],
      },
    });

    assert.equal(tensors.specVersion, ML_FEATURE_SPEC_VERSION);
    assert.equal(tensors.polygon.verticesNorm.length, ML_MAX_VERTICES);
    assert.equal(tensors.heads.length, ML_MAX_HEADS);
    assert.equal(tensors.headMask[0], 1);
    assert.equal(tensors.headMask[1], 0);
    assert.ok(tensors.polygon.globals.length >= 4 + 7);
  });
});

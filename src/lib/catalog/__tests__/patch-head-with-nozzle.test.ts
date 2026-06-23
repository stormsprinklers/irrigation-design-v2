import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patchHeadWithNozzle } from "../adjustability";
import type { CatalogItemData } from "../../domain/types";

const nozzle: CatalogItemData = {
  id: "test_nozzle",
  category: "SPRAY_NOZZLE",
  manufacturer: "Hunter",
  model: "12H",
  specs: {
    radiusFeetMin: 8,
    radiusFeetMax: 12,
    arcDegreesMin: 90,
    arcDegreesMax: 360,
  },
  nozzleChart: {
    pressurePsi: [30],
    gpm: [1.2],
    radiusFeet: [12],
    precipInPerHr: [1.5],
  },
};

describe("patchHeadWithNozzle", () => {
  it("rotation-only patch with explicit undefined fields preserves arc and radius", () => {
    const head = {
      arcDegrees: 180,
      radiusFeet: 12,
      rotationDegrees: 0,
      gpm: 1.2,
      precipInPerHr: 1.5,
    };

    const next = patchHeadWithNozzle(
      head,
      {
        arcDegrees: undefined,
        radiusFeet: undefined,
        rotationDegrees: 45,
      },
      nozzle,
      65
    );

    assert.equal(next.rotationDegrees, 45);
    assert.equal(next.arcDegrees, 180);
    assert.equal(next.radiusFeet, 12);
    assert.ok(Number.isFinite(next.gpm));
    assert.ok(Number.isFinite(next.precipInPerHr!));
  });
});

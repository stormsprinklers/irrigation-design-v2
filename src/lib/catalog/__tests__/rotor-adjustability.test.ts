import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNozzleAdjustability, swapHeadNozzle } from "../adjustability";
import type { CatalogItemData } from "../../domain/types";

function rotorNozzle(specs: Record<string, unknown> = {}): CatalogItemData {
  return {
    id: "test_rotor_noz",
    category: "ROTOR",
    manufacturer: "Hunter",
    model: "Red Nozzle 0.50",
    specs: {
      nozzleFamily: "pgj_red",
      compatibleBodyCategories: ["ROTOR_BODY"],
      arcDegreesMin: 40,
      arcDegreesMax: 360,
      arcDegreesDefault: 180,
      arcAdjustable: false,
      radiusFeetMin: 12,
      radiusFeetMax: 16,
      ...specs,
    },
    nozzleChart: {
      pressurePsi: [45],
      gpm: [0.5],
      radiusFeet: [15],
      precipInPerHr: [0.4],
    },
  };
}

describe("rotor nozzle adjustability", () => {
  it("treats rotor nozzles as arc adjustable 40–360° even when catalog flag is false", () => {
    const adj = getNozzleAdjustability(rotorNozzle());
    assert.equal(adj.arcAdjustable, true);
    assert.equal(adj.arcDegreesMin, 40);
    assert.equal(adj.arcDegreesMax, 360);
  });

  it("does not mark full-circle-only rotor arc as adjustable", () => {
    const adj = getNozzleAdjustability(
      rotorNozzle({
        arcDegreesMin: 360,
        arcDegreesMax: 360,
        arcDegreesDefault: 360,
      })
    );
    assert.equal(adj.arcAdjustable, false);
  });

  it("treats rotor radius as adjustable down to 50% of max throw", () => {
    const adj = getNozzleAdjustability(
      rotorNozzle({
        radiusAdjustable: false,
        radiusFeetMin: 12,
        radiusFeetMax: 16,
      })
    );
    assert.equal(adj.radiusAdjustable, true);
    assert.equal(adj.radiusFeetMin, 8);
    assert.equal(adj.radiusFeetMax, 16);
  });

  it("does not mark fixed-radius rotors as radius adjustable", () => {
    const adj = getNozzleAdjustability(
      rotorNozzle({
        radiusFeetMin: 20,
        radiusFeetMax: 20,
      })
    );
    assert.equal(adj.radiusAdjustable, false);
  });

  it("swapHeadNozzle keeps arc, radius, and rotation unchanged", () => {
    const nozzleB = rotorNozzle({
      radiusFeetMin: 10,
      radiusFeetMax: 20,
      arcDegreesDefault: 90,
    });
    const head = {
      arcDegrees: 90,
      radiusFeet: 18,
      rotationDegrees: 135,
    };
    const hyd = swapHeadNozzle(head, nozzleB, 45);
    assert.equal(head.arcDegrees, 90);
    assert.equal(head.radiusFeet, 18);
    assert.equal(head.rotationDegrees, 135);
    assert.equal(hyd.gpm, 0.5);
    assert.ok(typeof hyd.precipInPerHr === "number");
  });

  it("GPM is unchanged when arc differs for the same rotor nozzle", () => {
    const nozzle = rotorNozzle();
    const narrow = swapHeadNozzle({ arcDegrees: 90, radiusFeet: 15, rotationDegrees: 0 }, nozzle, 45);
    const wide = swapHeadNozzle({ arcDegrees: 270, radiusFeet: 15, rotationDegrees: 0 }, nozzle, 45);
    assert.equal(narrow.gpm, wide.gpm);
    assert.equal(narrow.gpm, 0.5);
  });
});

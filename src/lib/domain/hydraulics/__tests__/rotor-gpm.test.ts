import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateNozzleHydraulics } from "../index";
import { finalizeHeadHydraulics } from "../../placement/assign-arcs";
import type { CatalogItemData, SprinklerHead } from "../../types";

function rotorNozzle(): CatalogItemData {
  return {
    id: "rotor_noz",
    category: "ROTOR",
    manufacturer: "Hunter",
    model: "Red 0.50",
    specs: { compatibleBodyCategories: ["ROTOR_BODY"] },
    nozzleChart: {
      pressurePsi: [45],
      gpm: [0.5],
      radiusFeet: [15],
      precipInPerHr: [0.4],
    },
  };
}

describe("rotor GPM vs arc", () => {
  it("keeps GPM constant when arc changes for the same rotor nozzle", () => {
    const nozzle = rotorNozzle();
    const at90 = calculateNozzleHydraulics(nozzle, 45, 90);
    const at180 = calculateNozzleHydraulics(nozzle, 45, 180);
    const at360 = calculateNozzleHydraulics(nozzle, 45, 360);
    assert.equal(at90.gpm, 0.5);
    assert.equal(at180.gpm, 0.5);
    assert.equal(at360.gpm, 0.5);
  });

  it("finalizeHeadHydraulics does not scale rotor GPM by arc", () => {
    const nozzle = rotorNozzle();
    const heads: SprinklerHead[] = [
      {
        id: "h1",
        zoneId: "z",
        hydrozoneId: "hz",
        position: { x: 0, y: 0 },
        catalogItemId: nozzle.id,
        arcDegrees: 90,
        radiusFeet: 15,
        rotationDegrees: 0,
        locked: false,
      },
      {
        id: "h2",
        zoneId: "z",
        hydrozoneId: "hz",
        position: { x: 10, y: 0 },
        catalogItemId: nozzle.id,
        arcDegrees: 270,
        radiusFeet: 15,
        rotationDegrees: 0,
        locked: false,
      },
    ];
    const finalized = finalizeHeadHydraulics(heads, nozzle, 45, "square");
    assert.equal(finalized[0]!.gpm, 0.5);
    assert.equal(finalized[1]!.gpm, 0.5);
  });
});

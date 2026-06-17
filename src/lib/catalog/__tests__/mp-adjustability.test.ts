import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNozzleAdjustability } from "../adjustability";
import { calculateNozzleHydraulics } from "../../domain/hydraulics";
import type { CatalogItemData } from "../../domain/types";

function mpNozzle(model: string, specs: Record<string, unknown> = {}): CatalogItemData {
  return {
    id: `test_${model}`,
    category: "MP_ROTATOR",
    manufacturer: "Hunter",
    model,
    specs: {
      nozzleFamily: "hunter_mp_rotator",
      radiusFeetMin: 8,
      radiusFeetMax: 15,
      ...specs,
    },
    nozzleChart: {
      pressurePsi: [45],
      gpm: [0.6],
      radiusFeet: [12],
      precipInPerHr: [0.4],
    },
  };
}

describe("MP nozzle adjustability", () => {
  it("MP1000-90 is adjustable 90–210° with fixed left edge", () => {
    const adj = getNozzleAdjustability(mpNozzle("MP1000-90"));
    assert.equal(adj.mpArcBand, "90_210");
    assert.equal(adj.arcDegreesMin, 90);
    assert.equal(adj.arcDegreesMax, 210);
    assert.equal(adj.arcAdjustable, true);
    assert.equal(adj.fixedLeftEdge, true);
  });

  it("MP2000-210 is adjustable 210–270°", () => {
    const adj = getNozzleAdjustability(mpNozzle("MP2000-210"));
    assert.equal(adj.mpArcBand, "210_270");
    assert.equal(adj.arcDegreesMin, 210);
    assert.equal(adj.arcDegreesMax, 270);
    assert.equal(adj.arcAdjustable, true);
  });

  it("MP3000-360 is fixed full circle", () => {
    const adj = getNozzleAdjustability(mpNozzle("MP3000-360"));
    assert.equal(adj.mpArcBand, "360");
    assert.equal(adj.arcDegreesMin, 360);
    assert.equal(adj.arcDegreesMax, 360);
    assert.equal(adj.arcAdjustable, false);
    assert.equal(adj.fixedLeftEdge, false);
  });

  it("scales GPM by arc relative to chart reference", () => {
    const nozzle = mpNozzle("MP1000-90", {
      chartReferenceArcDegrees: 180,
      arcDegreesDefault: 180,
    });
    const full = calculateNozzleHydraulics(nozzle, 45, 180);
    const half = calculateNozzleHydraulics(nozzle, 45, 90);
    assert.ok(Math.abs(half.gpm - full.gpm * 0.5) < 0.01);
  });
});

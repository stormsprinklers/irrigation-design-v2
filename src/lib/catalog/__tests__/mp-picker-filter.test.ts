import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferMpArcBand } from "../mp-arc-bands";
import { getNozzlesForHead, isValidMpRotatorPickerNozzle } from "../compat";
import type { CatalogItemData } from "../../domain/types";

function mpNozzle(
  id: string,
  model: string,
  specs: Record<string, unknown> = {}
): CatalogItemData {
  return {
    id,
    category: "MP_ROTATOR",
    manufacturer: "Hunter",
    model,
    specs: {
      nozzleFamily: "hunter_mp_rotator",
      compatibleHeadFamilies: ["hunter_pro_spray"],
      ...specs,
    },
  };
}

describe("MP rotator picker filter", () => {
  it("rejects legacy 40° MP models", () => {
    assert.equal(
      isValidMpRotatorPickerNozzle(mpNozzle("bad", "MP1000 40°", { mpArcBand: "90_210" })),
      false
    );
  });

  it("requires mpArcBand for standard MP rotators", () => {
    assert.equal(isValidMpRotatorPickerNozzle(mpNozzle("bad2", "MP1000-90", {})), false);
    assert.equal(
      isValidMpRotatorPickerNozzle(mpNozzle("good", "MP1000-90", { mpArcBand: "90_210" })),
      true
    );
  });

  it("allows strip and corner MP nozzles", () => {
    assert.equal(
      isValidMpRotatorPickerNozzle(
        mpNozzle("strip", "MPSSS530", { stripPattern: "side_strip" })
      ),
      true
    );
    assert.equal(
      isValidMpRotatorPickerNozzle(mpNozzle("corner", "MP Corner", { mpModel: "MP Corner" })),
      true
    );
  });

  it("getNozzlesForHead excludes invalid MP SKUs", () => {
    const head: CatalogItemData = {
      id: "head_ps",
      category: "SPRAY_BODY",
      manufacturer: "Hunter",
      model: "Pro-Spray",
      specs: { headFamily: "hunter_pro_spray" },
    };
    const catalog = [
      head,
      mpNozzle("mp90", "MP1000-90", { mpArcBand: "90_210" }),
      mpNozzle("mp40", "MP1000 40°", { mpArcBand: "90_210" }),
      mpNozzle("legacy", "MP2000", {}),
    ];
    const models = getNozzlesForHead(catalog, "head_ps").map((n) => n.model);
    assert.deepEqual(models, ["MP1000-90"]);
  });
});

describe("inferMpArcBand", () => {
  it("does not map 40° factory arc to 90_210 band", () => {
    assert.equal(
      inferMpArcBand(mpNozzle("x", "MP1000", { arcDegrees: 40 })),
      undefined
    );
  });
});

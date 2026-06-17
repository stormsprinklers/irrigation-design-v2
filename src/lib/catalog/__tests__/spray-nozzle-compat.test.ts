import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterNozzlesByGroup,
  getNozzlePickerGroup,
  getNozzlesForHead,
} from "../compat";
import type { CatalogItemData } from "../../domain/types";

function sprayBody(id: string, headFamily: string): CatalogItemData {
  return {
    id,
    category: "SPRAY_BODY",
    manufacturer: "Test",
    model: id,
    specs: { headFamily, itemRole: "body" },
  };
}

function sprayNozzle(
  id: string,
  model: string,
  specs: Record<string, unknown>
): CatalogItemData {
  return {
    id,
    category: "SPRAY",
    manufacturer: "Rain Bird",
    model,
    specs: {
      itemRole: "nozzle",
      compatibleBodyCategories: ["SPRAY_BODY"],
      ...specs,
    },
  };
}

describe("spray body universal nozzle compatibility", () => {
  const hunterHead = sprayBody("head_hunter", "hunter_pro_spray");
  const rbHead = sprayBody("head_rb", "rainbird_1800");

  const mpr = sprayNozzle("noz_mpr", "5Q", {
    nozzleFamily: "rainbird_mpr",
    compatibleHeadFamilies: ["rainbird_1800"],
    arcAdjustable: false,
  });
  const van = sprayNozzle("noz_van", "12-VAN", {
    nozzleFamily: "rainbird_van",
    compatibleHeadFamilies: ["rainbird_1800"],
    arcAdjustable: true,
  });
  const strip = sprayNozzle("noz_strip", "15SST", {
    nozzleFamily: "rainbird_mpr_strip",
    compatibleHeadFamilies: ["rainbird_1800"],
    stripPattern: "side",
    arcAdjustable: false,
  });
  const mp: CatalogItemData = {
    id: "noz_mp",
    category: "MP_ROTATOR",
    manufacturer: "Hunter",
    model: "MP1000-90",
    specs: {
      nozzleFamily: "hunter_mp_rotator",
      compatibleHeadFamilies: ["hunter_pro_spray"],
      compatibleBodyCategories: ["SPRAY_BODY"],
      mpArcBand: "90_210",
    },
  };
  const rotorNozzle: CatalogItemData = {
    id: "noz_rotor",
    category: "ROTOR",
    manufacturer: "Hunter",
    model: "Red 2.0",
    specs: {
      nozzleFamily: "pgj_red",
      compatibleHeadFamilies: ["hunter_pgj"],
      compatibleBodyCategories: ["ROTOR_BODY"],
    },
  };

  const catalog = [hunterHead, rbHead, mpr, van, strip, mp, rotorNozzle];

  it("offers MPR, VAN, and strip nozzles on Hunter spray bodies", () => {
    const ids = getNozzlesForHead(catalog, "head_hunter").map((n) => n.id);
    assert.ok(ids.includes("noz_mpr"));
    assert.ok(ids.includes("noz_van"));
    assert.ok(ids.includes("noz_strip"));
    assert.ok(ids.includes("noz_mp"));
    assert.ok(!ids.includes("noz_rotor"));
  });

  it("offers MP rotators on Rain Bird spray bodies", () => {
    const ids = getNozzlesForHead(catalog, "head_rb").map((n) => n.id);
    assert.ok(ids.includes("noz_mp"));
    assert.ok(ids.includes("noz_mpr"));
    assert.ok(!ids.includes("noz_rotor"));
  });

  it("classifies strip nozzles under the fixed picker group", () => {
    assert.equal(getNozzlePickerGroup(strip), "fixed");
    const fixed = filterNozzlesByGroup(
      getNozzlesForHead(catalog, "head_hunter"),
      "fixed"
    ).map((n) => n.id);
    assert.ok(fixed.includes("noz_strip"));
    assert.ok(fixed.includes("noz_mpr"));
  });
});

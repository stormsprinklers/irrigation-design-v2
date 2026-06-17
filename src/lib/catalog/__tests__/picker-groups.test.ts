import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getBodyPickerGroup,
  getNozzlePickerGroup,
  filterNozzlesByGroup,
} from "../compat";
import type { CatalogItemData } from "@/lib/domain/types";

function nozzle(partial: Partial<CatalogItemData> & { id: string }): CatalogItemData {
  return {
    category: "SPRAY",
    manufacturer: "Rain Bird",
    model: partial.id,
    specs: {},
    ...partial,
  };
}

describe("catalog picker groups", () => {
  it("classifies spray and rotor bodies", () => {
    assert.equal(
      getBodyPickerGroup({ id: "h1", category: "SPRAY_BODY", manufacturer: "RB", model: "1804", specs: {} }),
      "spray"
    );
    assert.equal(
      getBodyPickerGroup({ id: "h2", category: "ROTOR_BODY", manufacturer: "H", model: "PGP", specs: {} }),
      "rotor"
    );
  });

  it("classifies nozzles into fixed, rotary, and VAN", () => {
    assert.equal(
      getNozzlePickerGroup(
        nozzle({ id: "n1", category: "MP_ROTATOR", specs: { nozzleFamily: "rainbird_rvan" } })
      ),
      "rotary"
    );
    assert.equal(
      getNozzlePickerGroup(
        nozzle({ id: "n2", specs: { nozzleFamily: "rainbird_he_van", arcAdjustable: true } })
      ),
      "van"
    );
    assert.equal(
      getNozzlePickerGroup(
        nozzle({ id: "n3", specs: { nozzleFamily: "rainbird_mpr", arcAdjustable: false } })
      ),
      "fixed"
    );
    assert.equal(
      getNozzlePickerGroup(
        nozzle({ id: "n4", category: "ROTOR", specs: { nozzleFamily: "rainbird_5000_std" } })
      ),
      "fixed"
    );
  });

  it("filters nozzles by group", () => {
    const items = [
      nozzle({ id: "a", category: "MP_ROTATOR", specs: { nozzleFamily: "hunter_mp_rotator" } }),
      nozzle({ id: "b", specs: { nozzleFamily: "rainbird_mpr" } }),
      nozzle({ id: "c", specs: { nozzleFamily: "rainbird_van", arcAdjustable: true } }),
    ];
    assert.deepEqual(filterNozzlesByGroup(items, "rotary").map((n) => n.id), ["a"]);
    assert.deepEqual(filterNozzlesByGroup(items, "fixed").map((n) => n.id), ["b"]);
    assert.deepEqual(filterNozzlesByGroup(items, "van").map((n) => n.id), ["c"]);
  });

  it("sorts nozzles alphabetically by model within a group", () => {
    const items = [
      nozzle({ id: "z", model: "Zeta MPR", specs: { nozzleFamily: "rainbird_mpr" } }),
      nozzle({ id: "a", model: "Alpha MPR", specs: { nozzleFamily: "rainbird_mpr" } }),
      nozzle({ id: "m", model: "Middle MPR", specs: { nozzleFamily: "rainbird_mpr" } }),
    ];
    assert.deepEqual(filterNozzlesByGroup(items, "fixed").map((n) => n.model), [
      "Alpha MPR",
      "Middle MPR",
      "Zeta MPR",
    ]);
  });
});

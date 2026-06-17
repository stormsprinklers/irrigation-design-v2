import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { CatalogItemData } from "../../types";
import { getNozzleAdjustability } from "@/lib/catalog/adjustability";
import {
  PGP_ADJ_HEAD_BODY_ID,
  assignPgpAdjNozzlesToHeads,
  findPgpAdjNozzle,
  pgpAdjNozzleSizeForArc,
  selectPgpAdjAssembly,
} from "../pgp-adj-placement";
import { analyzePolygon } from "../geometry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dirname, "../../../../../prisma/seed-data/catalog-items.json"), "utf8")
) as CatalogItemData[];

describe("pgp-adj placement", () => {
  it("maps arc degrees to MPR nozzle sizes", () => {
    assert.equal(pgpAdjNozzleSizeForArc(90), 1.5);
    assert.equal(pgpAdjNozzleSizeForArc(180), 3);
    assert.equal(pgpAdjNozzleSizeForArc(270), 5);
    assert.equal(pgpAdjNozzleSizeForArc(360), 6);
  });

  it("selects PGP-ADJ body with a 3.0 nozzle for spacing", () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 55, y: 0 },
      { x: 55, y: 30 },
      { x: 0, y: 30 },
    ];
    const assembly = selectPgpAdjAssembly(catalog, analyzePolygon(vertices, 1), 65);
    assert.ok(assembly);
    assert.equal(assembly.headBodyId, PGP_ADJ_HEAD_BODY_ID);
    assert.equal(assembly.nozzleId, "noz_pgp_adj_blue_3_0");
  });

  it("assigns per-head blue nozzles from arc", () => {
    const heads = assignPgpAdjNozzlesToHeads(
      catalog,
      [
        {
          id: "h1",
          zoneId: "z1",
          position: { x: 0, y: 0 },
          catalogItemId: "placeholder",
          arcDegrees: 90,
          radiusFeet: 30,
          rotationDegrees: 45,
          locked: false,
        },
        {
          id: "h2",
          zoneId: "z1",
          position: { x: 20, y: 0 },
          catalogItemId: "placeholder",
          arcDegrees: 180,
          radiusFeet: 30,
          rotationDegrees: 90,
          locked: false,
        },
        {
          id: "h3",
          zoneId: "z1",
          position: { x: 10, y: 10 },
          catalogItemId: "placeholder",
          arcDegrees: 360,
          radiusFeet: 30,
          rotationDegrees: 0,
          locked: false,
        },
      ],
      65,
      "square"
    );

    assert.equal(heads[0]?.catalogItemId, findPgpAdjNozzle(catalog, 1.5)?.id);
    assert.equal(heads[1]?.catalogItemId, findPgpAdjNozzle(catalog, 3)?.id);
    assert.equal(heads[2]?.catalogItemId, findPgpAdjNozzle(catalog, 6)?.id);
    assert.ok(heads.every((h) => h.headBodyId === PGP_ADJ_HEAD_BODY_ID));
  });

  it("clamps radius to the assigned MPR nozzle throw range", () => {
    const heads = assignPgpAdjNozzlesToHeads(
      catalog,
      [
        {
          id: "h1",
          zoneId: "z1",
          position: { x: 0, y: 0 },
          catalogItemId: "noz_pgp_adj_blue_3_0",
          arcDegrees: 90,
          radiusFeet: 39,
          rotationDegrees: 45,
          locked: false,
        },
      ],
      65,
      "square"
    );

    const nozzle = findPgpAdjNozzle(catalog, 1.5);
    assert.ok(nozzle);
    const adj = getNozzleAdjustability(nozzle!);
    assert.equal(heads[0]?.catalogItemId, nozzle!.id);
    assert.equal(heads[0]?.radiusFeet, adj.radiusFeetMax);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getStripNozzleSpec,
  isPointInStripPattern,
  stripPatternVertices,
} from "../strip-pattern";
import type { CatalogItemData } from "@/lib/domain/types";

function stripNozzle(model: string, width: number, length: number): CatalogItemData {
  return {
    id: `test_${model}`,
    category: "SPRAY",
    manufacturer: "Rain Bird",
    model,
    specs: {
      stripPattern: "side",
      patternWidthFt: width,
      patternLengthFt: length,
    },
  };
}

describe("strip-pattern", () => {
  it("detects strip nozzle specs from catalog", () => {
    const spec = getStripNozzleSpec(stripNozzle("15SST", 4, 30));
    assert.deepEqual(spec, { stripPattern: "side", patternWidthFt: 4, patternLengthFt: 30 });
  });

  it("side strip mounts on the long edge with throw across the short dimension", () => {
    const spec = { stripPattern: "side" as const, patternWidthFt: 4, patternLengthFt: 30 };
    const verts = stripPatternVertices({ x: 0, y: 0 }, 0, spec);
    const xs = verts.map((v) => v.x);
    const ys = verts.map((v) => v.y);
    assert.ok(Math.max(...ys) - Math.min(...ys) >= 29);
    assert.ok(Math.max(...xs) - Math.min(...xs) <= 4.01);
    assert.equal(verts[0]?.x, 0);
    assert.equal(verts[0]?.y, -15);
    assert.equal(verts[1]?.y, 15);
  });

  it("9SST side strip is wider along the edge than the throw depth", () => {
    const spec = { stripPattern: "side" as const, patternWidthFt: 9, patternLengthFt: 18 };
    const verts = stripPatternVertices({ x: 0, y: 0 }, 0, spec);
    const xs = verts.map((v) => v.x);
    const ys = verts.map((v) => v.y);
    assert.ok(Math.max(...ys) - Math.min(...ys) >= 17);
    assert.ok(Math.max(...xs) - Math.min(...xs) <= 9.01);
  });

  it("covers points inside the strip rectangle but not outside", () => {
    const spec = { stripPattern: "side" as const, patternWidthFt: 4, patternLengthFt: 30 };
    assert.ok(isPointInStripPattern({ x: 2, y: 0 }, { x: 0, y: 0 }, 0, spec));
    assert.ok(isPointInStripPattern({ x: 2, y: 10 }, { x: 0, y: 0 }, 0, spec));
    assert.ok(!isPointInStripPattern({ x: 5, y: 0 }, { x: 0, y: 0 }, 0, spec));
    assert.ok(!isPointInStripPattern({ x: 2, y: 16 }, { x: 0, y: 0 }, 0, spec));
  });

  it("left corner strip extends forward and to the left only", () => {
    const spec = { stripPattern: "left_corner" as const, patternWidthFt: 5, patternLengthFt: 15 };
    assert.ok(isPointInStripPattern({ x: 10, y: -2 }, { x: 0, y: 0 }, 0, spec));
    assert.ok(!isPointInStripPattern({ x: 10, y: 2 }, { x: 0, y: 0 }, 0, spec));
  });
});

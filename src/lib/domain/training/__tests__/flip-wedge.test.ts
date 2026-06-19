import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  flippedRotationDegrees,
  wedgeBearingsForRotation,
} from "../flip-wedge";

describe("flip-wedge", () => {
  it("mirrors a partial arc to the opposite side of the bisector", () => {
    const before = wedgeBearingsForRotation(45, 90);
    const flipped = flippedRotationDegrees(45, 90);
    const after = wedgeBearingsForRotation(flipped, 90);

    assert.equal(before.start, 0);
    assert.equal(before.end, 90);
    assert.equal(after.start, 90);
    assert.equal(after.end, 180);
  });

  it("differs from rotating 180 degrees for partial arcs", () => {
    const flipped = wedgeBearingsForRotation(flippedRotationDegrees(45, 90), 90);
    const rotated = wedgeBearingsForRotation(225, 90);

    assert.notDeepEqual(flipped, rotated);
  });

  it("matches rotate 180 for full-circle heads", () => {
    const flipped = flippedRotationDegrees(30, 360);
    assert.equal(flipped, 210);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { snapHeadPositionToPolygon, snapHeadRotationToPolygon } from "../arc-edge-snap";

describe("arc-edge-snap", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 30 },
    { x: 0, y: 30 },
  ];

  it("snaps rotation when a wedge edge is near a polygon edge bearing", () => {
    const snapped = snapHeadRotationToPolygon(
      { rotationDegrees: 48, arcDegrees: 90 },
      square,
      12
    );
    assert.ok(snapped != null);
    assert.ok(Math.abs(snapped - 45) < 1 || Math.abs(snapped - 135) < 1);
  });

  it("returns null when no edge is within threshold", () => {
    const snapped = snapHeadRotationToPolygon(
      { rotationDegrees: 200, arcDegrees: 90 },
      square,
      3
    );
    assert.equal(snapped, null);
  });

  it("snaps head position to the nearest corner", () => {
    const snapped = snapHeadPositionToPolygon({ x: 1.5, y: 1.2 }, square, 2);
    assert.equal(snapped.x, 0);
    assert.equal(snapped.y, 0);
  });

  it("snaps head position to the nearest point on an edge", () => {
    const snapped = snapHeadPositionToPolygon({ x: 20, y: 1.3 }, square, 2);
    assert.equal(snapped.x, 20);
    assert.equal(snapped.y, 0);
  });

  it("leaves position unchanged when far from boundary", () => {
    const pos = { x: 20, y: 15 };
    const snapped = snapHeadPositionToPolygon(pos, square, 2);
    assert.deepEqual(snapped, pos);
  });
});

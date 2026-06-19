import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findNearestPolygonEdge,
  nextHeadPositionAlongEdgeAtArcEnd,
} from "../edge-duplicate";

describe("edge-duplicate", () => {
  const bottomEdgeSquare = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 30 },
    { x: 0, y: 30 },
  ];

  it("finds the nearest polygon edge to a head on the boundary", () => {
    const edge = findNearestPolygonEdge({ x: 10, y: 0.5 }, bottomEdgeSquare, 2);
    assert.ok(edge);
    assert.equal(edge.edgeIndex, 0);
    assert.ok(edge.distFt < 1);
  });

  it("places the next head one throw distance along the edge toward arc end", () => {
    const head = {
      positionFt: { x: 10, y: 0 },
      radiusFeet: 12,
      arcDegrees: 180,
      rotationDegrees: 90,
    };
    const next = nextHeadPositionAlongEdgeAtArcEnd(head, bottomEdgeSquare);
    assert.ok(next);
    assert.ok(Math.abs(next.y) < 0.01);
    assert.ok(next.x > head.positionFt.x);
    assert.ok(Math.abs(next.x - 22) < 0.5);
  });

  it("chains along the edge when repeated from the new position", () => {
    const head = {
      positionFt: { x: 10, y: 0 },
      radiusFeet: 12,
      arcDegrees: 180,
      rotationDegrees: 90,
    };
    const second = nextHeadPositionAlongEdgeAtArcEnd(head, bottomEdgeSquare);
    assert.ok(second);
    const third = nextHeadPositionAlongEdgeAtArcEnd(
      { ...head, positionFt: second },
      bottomEdgeSquare
    );
    assert.ok(third);
    assert.ok(third.x > second.x);
  });

  it("returns null when the head is not on a polygon edge", () => {
    const head = {
      positionFt: { x: 20, y: 15 },
      radiusFeet: 12,
      arcDegrees: 180,
      rotationDegrees: 90,
    };
    assert.equal(nextHeadPositionAlongEdgeAtArcEnd(head, bottomEdgeSquare), null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  scoreUniformity,
} from "../scoring";
import type { TrainingHeadSnapshot } from "../../training/types";

const emptyHeads: TrainingHeadSnapshot[] = [];

describe("scoreUniformity wet spots", () => {
  it("does not flag normal two-head overlap as wet", () => {
    // Covered lawn avg ~1.0; typical overlap ~2.0 should be fine (cutoff 3.5).
    const precipValues = [1, 1, 1, 1, 2, 2, 1, 1];
    const scores = scoreUniformity(emptyHeads, precipValues);
    assert.equal(scores.wetSpotCount, 0);
  });

  it("flags only extreme overlap above wet threshold", () => {
    const precipValues = [1, 1, 1, 1, 1, 1, 1, 10];
    const scores = scoreUniformity(emptyHeads, precipValues);
    assert.equal(scores.wetSpotCount, 1);
  });

  it("uses covered-point average so improving coverage does not inflate wet count", () => {
    const sparse = [0, 0, 0, 0, 1, 1, 2, 2];
    const improved = [1, 1, 1, 1, 1.2, 1.2, 2, 2];
    const sparseScores = scoreUniformity(emptyHeads, sparse);
    const improvedScores = scoreUniformity(emptyHeads, improved);
    assert.ok(improvedScores.wetSpotCount <= sparseScores.wetSpotCount);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeImprovementScore,
  scoreUniformity,
} from "../scoring";
import type { TrainingHeadSnapshot, UniformityScores } from "../../training/types";

const emptyHeads: TrainingHeadSnapshot[] = [];

function baseScores(overrides: Partial<UniformityScores> = {}): UniformityScores {
  return {
    coveragePercent: 80,
    avgPrecip: 1,
    minPrecip: 0,
    maxPrecip: 2,
    duLq: 0.6,
    drySpotCount: 5,
    wetSpotCount: 0,
    headToHeadViolations: 2,
    oversprayEstimatePercent: 10,
    headCount: 6,
    sampleCount: 100,
    ...overrides,
  };
}

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

describe("computeDuLq", () => {
  it("ignores uncovered zeros so filling gaps raises DU_LQ", () => {
    const sparse = [0, 0, 0, 0, 1, 1, 2, 2];
    const improved = [1, 1, 1, 1, 1.2, 1.2, 2, 2];
    const sparseScores = scoreUniformity(emptyHeads, sparse);
    const improvedScores = scoreUniformity(emptyHeads, improved);
    assert.ok(improvedScores.duLq > sparseScores.duLq);
  });
});

describe("computeImprovementScore", () => {
  it("rewards fewer dry spots and higher coverage", () => {
    const original = baseScores({ coveragePercent: 70, drySpotCount: 10, duLq: 0.5 });
    const approved = baseScores({ coveragePercent: 90, drySpotCount: 3, duLq: 0.65 });
    assert.ok(computeImprovementScore(original, approved) > 0);
  });

  it("can be negative when simulation metrics worsen", () => {
    const original = baseScores({ duLq: 0.7, wetSpotCount: 0 });
    const approved = baseScores({ duLq: 0.4, wetSpotCount: 6 });
    assert.ok(computeImprovementScore(original, approved) < 0);
  });

  it("rewards fewer head-to-head violations and less overspray", () => {
    const original = baseScores({ headToHeadViolations: 4, oversprayEstimatePercent: 20 });
    const approved = baseScores({ headToHeadViolations: 1, oversprayEstimatePercent: 5 });
    const withFixes = computeImprovementScore(original, approved);
    const withoutFixes = computeImprovementScore(original, baseScores());
    assert.ok(withFixes > withoutFixes);
  });
});

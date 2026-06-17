import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolveDefaultHeadSettings } from "@/lib/catalog/adjustability";
import {
  computeImprovementScore,
  estimateOversprayMetrics,
  evaluateDesign,
  scoreUniformity,
} from "../scoring";
import type { ExclusionZone } from "../../types";
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
    exclusionOversprayPercent: 0,
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

  it("rewards less overspray", () => {
    const original = baseScores({ oversprayEstimatePercent: 20 });
    const approved = baseScores({ oversprayEstimatePercent: 5 });
    const withFixes = computeImprovementScore(original, approved);
    const withoutFixes = computeImprovementScore(original, baseScores());
    assert.ok(withFixes > withoutFixes);
  });

  it("penalizes exclusion overspray much more than regular overspray", () => {
    const original = baseScores({ oversprayEstimatePercent: 5, exclusionOversprayPercent: 5 });
    const fixedRegular = baseScores({ oversprayEstimatePercent: 0, exclusionOversprayPercent: 5 });
    const fixedExclusion = baseScores({ oversprayEstimatePercent: 5, exclusionOversprayPercent: 0 });

    const regularFix = computeImprovementScore(original, fixedRegular);
    const exclusionFix = computeImprovementScore(original, fixedExclusion);

    assert.ok(exclusionFix > regularFix);
    assert.ok(exclusionFix >= regularFix * 10);
  });
});

describe("scoreUniformity dry spots near edge", () => {
  it("ignores dry samples within 2 ft of the polygon edge", () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 20 },
      { x: 0, y: 20 },
    ];
    const samplePoints = [
      { x: 1, y: 10 },
      { x: 15, y: 10 },
    ];
    const precipValues = [0.1, 1];
    const scores = scoreUniformity(emptyHeads, precipValues, {
      samplePoints,
      polygonVertices: vertices,
      drySpotEdgeMarginFt: 2,
    });
    assert.equal(scores.drySpotCount, 0);
  });

  it("still counts dry samples farther than 2 ft from the edge", () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 20 },
      { x: 0, y: 20 },
    ];
    const samplePoints = [
      { x: 1, y: 10 },
      { x: 15, y: 10 },
      { x: 16, y: 10 },
    ];
    const precipValues = [0.1, 0.15, 1];
    const scores = scoreUniformity(emptyHeads, precipValues, {
      samplePoints,
      polygonVertices: vertices,
      drySpotEdgeMarginFt: 2,
    });
    assert.equal(scores.drySpotCount, 1);
  });
});

describe("estimateOversprayMetrics", () => {
  it("counts exclusion overspray separately from regular overspray", () => {
    const lawn = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
      { x: 0, y: 30 },
    ];
    const exclusions: ExclusionZone[] = [
      {
        id: "ex-1",
        name: "Building",
        exclusionType: "BUILDING",
        vertices: [
          { x: 28, y: 10 },
          { x: 35, y: 10 },
          { x: 35, y: 20 },
          { x: 28, y: 20 },
        ],
      },
    ];
    const heads: TrainingHeadSnapshot[] = [
      {
        id: "h1",
        positionFt: { x: 28, y: 15 },
        radiusFeet: 6,
        arcDegrees: 90,
        rotationDegrees: 0,
        wedgeStartDeg: 315,
        wedgeEndDeg: 45,
        catalogItemId: "test",
      },
    ];

    const metrics = estimateOversprayMetrics(lawn, heads, exclusions);
    assert.ok(metrics.exclusionOversprayPercent > 0);
    assert.ok(metrics.exclusionOversprayPercent >= metrics.oversprayEstimatePercent);
  });
});

describe("evaluateDesign radial taper", () => {
  it("applies precip falloff for full-circle (360°) rotor arcs", () => {
    const catalog = JSON.parse(
      readFileSync("prisma/seed-data/catalog-items.json", "utf8")
    ) as import("@/lib/domain/types").CatalogItemData[];
    const pgjNoz = catalog.find((c) => c.id === "noz_pgj_red_2_0");
    assert.ok(pgjNoz);
    const settings = resolveDefaultHeadSettings(pgjNoz, 65);
    const head: TrainingHeadSnapshot = {
      id: "h1",
      positionFt: { x: 50, y: 50 },
      radiusFeet: settings.radiusFeet,
      arcDegrees: 360,
      rotationDegrees: 0,
      wedgeStartDeg: 0,
      wedgeEndDeg: 360,
      catalogItemId: pgjNoz.id,
      gpm: settings.gpm,
      precipInPerHr: settings.precipInPerHr,
    };
    const lawn = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const { precipValues } = evaluateDesign(lawn, [head]);
    const covered = precipValues.filter((v) => v > 0);
    assert.ok(covered.length > 0, "360° arc should cover interior samples");
    const min = Math.min(...covered);
    const max = Math.max(...covered);
    assert.ok(max > min * 1.5, "precip should taper from head to edge");
  });
});

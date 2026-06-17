import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeProgressUpdate,
  createDefaultGamificationState,
  levelFromXp,
  parseGamificationState,
  toDateKey,
} from "../gamification";
import type { TrainingExamplePayload } from "../types";

function samplePayload(overrides: Partial<TrainingExamplePayload> = {}): TrainingExamplePayload {
  return {
    algorithmVersion: "test",
    polygonVerticesFt: [],
    polygonMetadata: {
      shapeClass: "rectangle",
      seed: 1,
      widthFt: 30,
      heightFt: 30,
      areaSqFt: 900,
      vertexCount: 4,
      sideLengthsFt: [30, 30, 30, 30],
      hasExclusions: false,
      rotationDeg: 0,
    },
    placementContext: {
      headPreference: "MP_ROTATOR",
      pressurePsi: 65,
      catalogItemIds: [],
    },
    algorithmOutput: [],
    approvedOutput: [],
    originalScores: {
      coveragePercent: 80,
      avgPrecip: 1,
      minPrecip: 0.5,
      maxPrecip: 1.5,
      duLq: 0.7,
      drySpotCount: 5,
      wetSpotCount: 1,
      headToHeadViolations: 0,
      oversprayEstimatePercent: 2,
      exclusionOversprayPercent: 0,
      headCount: 4,
      sampleCount: 100,
    },
    approvedScores: {
      coveragePercent: 90,
      avgPrecip: 1,
      minPrecip: 0.6,
      maxPrecip: 1.4,
      duLq: 0.8,
      drySpotCount: 2,
      wetSpotCount: 1,
      headToHeadViolations: 0,
      oversprayEstimatePercent: 1,
      exclusionOversprayPercent: 0,
      headCount: 4,
      sampleCount: 100,
    },
    originalPrecipGrid: { originFt: { x: 0, y: 0 }, stepFt: 1.5, cols: 1, rows: 1, values: [1] },
    approvedPrecipGrid: { originFt: { x: 0, y: 0 }, stepFt: 1.5, cols: 1, rows: 1, values: [1] },
    improvementScore: 12,
    editLog: {
      added: [],
      deleted: [],
      moved: [{ id: "h1", from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, deltaFt: 1 }],
      changed: [],
    },
    ...overrides,
  };
}

describe("training gamification", () => {
  it("awards base XP and meaningful edit bonus", () => {
    const result = computeProgressUpdate(
      createDefaultGamificationState(),
      samplePayload(),
      new Date("2026-06-16T12:00:00Z")
    );
    assert.ok(result.xpGained >= 10 + 5 + 12 + 15);
    assert.equal(result.state.streak, 1);
    assert.ok(result.achievementsUnlocked.includes("first_correction"));
  });

  it("continues streak on consecutive days", () => {
    const state = createDefaultGamificationState();
    state.streak = 2;
    state.lastActiveDate = "2026-06-15";
    const result = computeProgressUpdate(
      state,
      samplePayload(),
      new Date("2026-06-16T12:00:00Z")
    );
    assert.equal(result.state.streak, 3);
    assert.ok(result.streakIncreased);
  });

  it("resets streak after a missed day", () => {
    const state = createDefaultGamificationState();
    state.streak = 5;
    state.lastActiveDate = "2026-06-10";
    const result = computeProgressUpdate(
      state,
      samplePayload(),
      new Date("2026-06-16T12:00:00Z")
    );
    assert.equal(result.state.streak, 1);
  });

  it("grants daily goal bonus once per day", () => {
    const state = createDefaultGamificationState();
    state.dailyGoal = 2;
    state.dailyDate = "2026-06-16";
    state.dailyApprovalsToday = 1;
    const result = computeProgressUpdate(
      state,
      samplePayload(),
      new Date("2026-06-16T18:00:00Z")
    );
    assert.ok(result.dailyGoalJustCompleted);
    assert.ok(result.xpGained >= 20);
  });

  it("levels up when crossing XP threshold", () => {
    const state = createDefaultGamificationState();
    state.xp = 95;
    const result = computeProgressUpdate(
      state,
      samplePayload({ improvementScore: 20 }),
      new Date("2026-06-16T12:00:00Z")
    );
    assert.ok(result.leveledUp);
    assert.ok(result.newLevel >= 2);
  });

  it("parses partial stored state", () => {
    const parsed = parseGamificationState({ xp: 50, streak: 2 });
    assert.equal(parsed.xp, 50);
    assert.equal(parsed.streak, 2);
    assert.equal(parsed.dailyGoal, 3);
  });

  it("uses stable date keys", () => {
    assert.equal(toDateKey(new Date("2026-06-16T23:00:00Z"), "UTC"), "2026-06-16");
  });

  it("computes level from XP", () => {
    assert.equal(levelFromXp(0).level, 1);
    assert.equal(levelFromXp(150).level, 2);
  });
});

import { ACHIEVEMENTS, shapeAchievementId } from "./achievements";
import {
  TRAINING_SHAPE_CLASSES,
  type TrainingExamplePayload,
  type TrainingShapeClass,
} from "./types";

export type DailyQuestId =
  | "positive_improvement"
  | "uncommon_shape"
  | "reduce_dry_spots";

export type TrainingGamificationState = {
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  dailyGoal: number;
  dailyApprovalsToday: number;
  dailyDate: string | null;
  dailyGoalBonusClaimed: boolean;
  unlockedAchievements: string[];
  shapeApprovals: Record<TrainingShapeClass, number>;
  dailyQuestId: DailyQuestId | null;
  dailyQuestDate: string | null;
  dailyQuestCompleted: boolean;
};

export type TrainingProgressView = TrainingGamificationState & {
  levelTitle: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpProgressPercent: number;
  dailyQuest: DailyQuestId | null;
  dailyQuestLabel: string | null;
  suggestedShape: TrainingShapeClass | null;
};

export type ProgressUpdateResult = {
  state: TrainingGamificationState;
  xpGained: number;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  achievementsUnlocked: string[];
  streakIncreased: boolean;
  dailyGoalJustCompleted: boolean;
  dailyQuestJustCompleted: boolean;
};

export const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0, title: "Sprinkler Apprentice" },
  { level: 2, xp: 100, title: "Layout Learner" },
  { level: 3, xp: 250, title: "Coverage Cadet" },
  { level: 4, xp: 500, title: "Zone Technician" },
  { level: 5, xp: 1000, title: "Irrigation Specialist" },
  { level: 6, xp: 1750, title: "Layout Pro" },
  { level: 7, xp: 2750, title: "Uniformity Expert" },
  { level: 8, xp: 4000, title: "Master Hydrologist" },
] as const;

const UNCOMMON_SHAPES: TrainingShapeClass[] = [
  "l_shape",
  "concave",
  "narrow_strip",
  "irregular",
];

const DAILY_QUEST_POOL: { id: DailyQuestId; label: string }[] = [
  { id: "positive_improvement", label: "Approve a layout with positive improvement" },
  { id: "uncommon_shape", label: "Correct an L-shape, concave, strip, or irregular lawn" },
  { id: "reduce_dry_spots", label: "Reduce dry spots vs the algorithm" },
];

function emptyShapeCounts(): Record<TrainingShapeClass, number> {
  return Object.fromEntries(
    TRAINING_SHAPE_CLASSES.map((shape) => [shape, 0])
  ) as Record<TrainingShapeClass, number>;
}

export function toDateKey(date: Date, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function createDefaultGamificationState(): TrainingGamificationState {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    dailyGoal: 3,
    dailyApprovalsToday: 0,
    dailyDate: null,
    dailyGoalBonusClaimed: false,
    unlockedAchievements: [],
    shapeApprovals: emptyShapeCounts(),
    dailyQuestId: null,
    dailyQuestDate: null,
    dailyQuestCompleted: false,
  };
}

export function parseGamificationState(raw: unknown): TrainingGamificationState {
  const base = createDefaultGamificationState();
  if (!raw || typeof raw !== "object") return base;

  const o = raw as Record<string, unknown>;
  const shapeApprovals = { ...base.shapeApprovals };
  if (o.shapeApprovals && typeof o.shapeApprovals === "object") {
    for (const shape of TRAINING_SHAPE_CLASSES) {
      const n = (o.shapeApprovals as Record<string, unknown>)[shape];
      if (typeof n === "number" && Number.isFinite(n)) {
        shapeApprovals[shape] = n;
      }
    }
  }

  const unlocked = Array.isArray(o.unlockedAchievements)
    ? o.unlockedAchievements.filter((id): id is string => typeof id === "string")
    : [];

  const dailyQuestId =
    o.dailyQuestId === "positive_improvement" ||
    o.dailyQuestId === "uncommon_shape" ||
    o.dailyQuestId === "reduce_dry_spots"
      ? o.dailyQuestId
      : null;

  const state: TrainingGamificationState = {
    xp: typeof o.xp === "number" ? o.xp : base.xp,
    level: typeof o.level === "number" ? o.level : base.level,
    streak: typeof o.streak === "number" ? o.streak : base.streak,
    longestStreak: typeof o.longestStreak === "number" ? o.longestStreak : base.longestStreak,
    lastActiveDate: typeof o.lastActiveDate === "string" ? o.lastActiveDate : null,
    dailyGoal:
      typeof o.dailyGoal === "number" && o.dailyGoal >= 1 && o.dailyGoal <= 5
        ? o.dailyGoal
        : base.dailyGoal,
    dailyApprovalsToday:
      typeof o.dailyApprovalsToday === "number" ? o.dailyApprovalsToday : base.dailyApprovalsToday,
    dailyDate: typeof o.dailyDate === "string" ? o.dailyDate : null,
    dailyGoalBonusClaimed:
      typeof o.dailyGoalBonusClaimed === "boolean" ? o.dailyGoalBonusClaimed : false,
    unlockedAchievements: unlocked,
    shapeApprovals,
    dailyQuestId,
    dailyQuestDate: typeof o.dailyQuestDate === "string" ? o.dailyQuestDate : null,
    dailyQuestCompleted:
      typeof o.dailyQuestCompleted === "boolean" ? o.dailyQuestCompleted : false,
  };

  state.level = levelFromXp(state.xp).level;
  return state;
}

export function levelFromXp(xp: number): {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
} {
  let current: (typeof LEVEL_THRESHOLDS)[number] = LEVEL_THRESHOLDS[0];
  for (const tier of LEVEL_THRESHOLDS) {
    if (xp >= tier.xp) current = tier;
  }
  const next = LEVEL_THRESHOLDS.find((t) => t.level === current.level + 1);
  const xpIntoLevel = xp - current.xp;
  const xpForNextLevel = next ? next.xp - current.xp : 0;
  return {
    level: current.level,
    title: current.title,
    xpIntoLevel,
    xpForNextLevel,
  };
}

function pickDailyQuest(dateKey: string): DailyQuestId {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return DAILY_QUEST_POOL[hash % DAILY_QUEST_POOL.length]!.id;
}

export function refreshDailyGamificationState(
  state: TrainingGamificationState,
  now = new Date(),
  timeZone = "UTC"
): TrainingGamificationState {
  const next = {
    ...state,
    shapeApprovals: { ...state.shapeApprovals },
    unlockedAchievements: [...state.unlockedAchievements],
  };
  resetDailyCountersIfNeeded(next, toDateKey(now, timeZone));
  return next;
}

function dailyQuestLabel(id: DailyQuestId): string {
  return DAILY_QUEST_POOL.find((q) => q.id === id)?.label ?? "";
}

function ensureDailyQuest(state: TrainingGamificationState, today: string): void {
  if (state.dailyQuestDate !== today) {
    state.dailyQuestId = pickDailyQuest(today);
    state.dailyQuestDate = today;
    state.dailyQuestCompleted = false;
  }
}

function resetDailyCountersIfNeeded(state: TrainingGamificationState, today: string): void {
  if (state.dailyDate !== today) {
    state.dailyDate = today;
    state.dailyApprovalsToday = 0;
    state.dailyGoalBonusClaimed = false;
  }
  ensureDailyQuest(state, today);
}

function updateStreak(state: TrainingGamificationState, today: string): boolean {
  let streakIncreased = false;
  if (state.lastActiveDate === today) {
    return false;
  }
  if (state.lastActiveDate === previousDateKey(today)) {
    state.streak += 1;
    streakIncreased = true;
  } else {
    state.streak = 1;
    streakIncreased = state.streak === 1;
  }
  state.lastActiveDate = today;
  state.longestStreak = Math.max(state.longestStreak, state.streak);
  return streakIncreased;
}

function hasMeaningfulEdit(payload: TrainingExamplePayload): boolean {
  const log = payload.editLog;
  if (!log) return false;
  return log.added.length > 0 || log.deleted.length > 0 || log.moved.length > 0;
}

function questCompleted(
  questId: DailyQuestId,
  payload: TrainingExamplePayload,
  shape: TrainingShapeClass
): boolean {
  switch (questId) {
    case "positive_improvement":
      return payload.improvementScore > 0;
    case "uncommon_shape":
      return UNCOMMON_SHAPES.includes(shape);
    case "reduce_dry_spots":
      return payload.approvedScores.drySpotCount < payload.originalScores.drySpotCount;
    default:
      return false;
  }
}

function computeAchievementUnlocks(
  state: TrainingGamificationState,
  payload: TrainingExamplePayload,
  shape: TrainingShapeClass
): string[] {
  const unlocked = new Set(state.unlockedAchievements);
  const newly: string[] = [];

  function tryUnlock(id: string) {
    if (!unlocked.has(id) && ACHIEVEMENTS.some((a) => a.id === id)) {
      unlocked.add(id);
      newly.push(id);
    }
  }

  const totalApprovals = Object.values(state.shapeApprovals).reduce((a, b) => a + b, 0);
  if (totalApprovals >= 1) tryUnlock("first_correction");

  if (state.streak >= 3) tryUnlock("streak_3");
  if (state.streak >= 7) tryUnlock("streak_7");
  if (state.streak >= 30) tryUnlock("streak_30");

  if (state.shapeApprovals[shape] >= 1) tryUnlock(shapeAchievementId(shape));
  if (TRAINING_SHAPE_CLASSES.every((s) => state.shapeApprovals[s] >= 1)) {
    tryUnlock("shape_collector");
  }

  if (payload.improvementScore >= 15) tryUnlock("big_improvement");
  if (payload.approvedScores.drySpotCount < payload.originalScores.drySpotCount) {
    tryUnlock("dry_spot_fixer");
  }
  if ((payload.editLog?.moved.length ?? 0) >= 5) tryUnlock("heavy_editor");

  state.unlockedAchievements = [...unlocked];
  return newly;
}

export function computeProgressUpdate(
  rawState: TrainingGamificationState,
  payload: TrainingExamplePayload,
  now = new Date(),
  timeZone = "UTC"
): ProgressUpdateResult {
  const state: TrainingGamificationState = {
    ...rawState,
    shapeApprovals: { ...rawState.shapeApprovals },
    unlockedAchievements: [...rawState.unlockedAchievements],
  };

  const today = toDateKey(now, timeZone);
  resetDailyCountersIfNeeded(state, today);

  const shape = payload.polygonMetadata.shapeClass;
  const wasFirstShape = state.shapeApprovals[shape] === 0;
  state.shapeApprovals[shape] += 1;

  const previousLevel = levelFromXp(state.xp).level;
  let xpGained = 10;

  if (hasMeaningfulEdit(payload)) xpGained += 5;
  if (payload.improvementScore > 0) {
    xpGained += Math.min(25, Math.floor(payload.improvementScore));
  }
  if (wasFirstShape) xpGained += 15;

  const streakIncreased = updateStreak(state, today);

  state.dailyApprovalsToday += 1;
  let dailyGoalJustCompleted = false;
  if (
    state.dailyApprovalsToday >= state.dailyGoal &&
    !state.dailyGoalBonusClaimed
  ) {
    xpGained += 20;
    state.dailyGoalBonusClaimed = true;
    dailyGoalJustCompleted = true;
  }

  let dailyQuestJustCompleted = false;
  if (
    state.dailyQuestId &&
    !state.dailyQuestCompleted &&
    questCompleted(state.dailyQuestId, payload, shape)
  ) {
    xpGained += 25;
    state.dailyQuestCompleted = true;
    dailyQuestJustCompleted = true;
  }

  state.xp += xpGained;
  const levelInfo = levelFromXp(state.xp);
  state.level = levelInfo.level;
  const leveledUp = levelInfo.level > previousLevel;

  const achievementsUnlocked = computeAchievementUnlocks(state, payload, shape);

  return {
    state,
    xpGained,
    leveledUp,
    previousLevel,
    newLevel: levelInfo.level,
    achievementsUnlocked,
    streakIncreased,
    dailyGoalJustCompleted,
    dailyQuestJustCompleted,
  };
}

export function suggestNextShape(
  shapeApprovals: Record<TrainingShapeClass, number>
): TrainingShapeClass {
  return TRAINING_SHAPE_CLASSES.reduce((min, shape) =>
    shapeApprovals[shape] < shapeApprovals[min] ? shape : min
  );
}

export function shapeMasteryState(count: number): "locked" | "in_progress" | "mastered" {
  if (count <= 0) return "locked";
  if (count < 3) return "in_progress";
  return "mastered";
}

export function toProgressView(
  state: TrainingGamificationState
): TrainingProgressView {
  const levelInfo = levelFromXp(state.xp);
  const xpProgressPercent =
    levelInfo.xpForNextLevel > 0
      ? Math.min(100, Math.round((levelInfo.xpIntoLevel / levelInfo.xpForNextLevel) * 100))
      : 100;

  const questId = state.dailyQuestId;

  return {
    ...state,
    levelTitle: levelInfo.title,
    xpIntoLevel: levelInfo.xpIntoLevel,
    xpForNextLevel: levelInfo.xpForNextLevel,
    xpProgressPercent,
    dailyQuest: questId,
    dailyQuestLabel: questId ? dailyQuestLabel(questId) : null,
    suggestedShape: suggestNextShape(state.shapeApprovals),
  };
}

export function clampDailyGoal(goal: number): number {
  return Math.min(5, Math.max(1, Math.round(goal)));
}

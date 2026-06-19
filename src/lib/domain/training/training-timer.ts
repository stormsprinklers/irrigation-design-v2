import type { TrainingShapeClass } from "./types";

const STORAGE_KEY = "training-speed-best-v1";

export type TrainingSpeedBests = {
  overallSec: number | null;
  byShape: Partial<Record<TrainingShapeClass, number>>;
};

export function loadTrainingSpeedBests(): TrainingSpeedBests {
  if (typeof window === "undefined") {
    return { overallSec: null, byShape: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { overallSec: null, byShape: {} };
    const parsed = JSON.parse(raw) as TrainingSpeedBests;
    return {
      overallSec: parsed.overallSec ?? null,
      byShape: parsed.byShape ?? {},
    };
  } catch {
    return { overallSec: null, byShape: {} };
  }
}

export function saveTrainingSpeedBests(bests: TrainingSpeedBests): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bests));
}

export function recordTrainingSpeedBest(
  bests: TrainingSpeedBests,
  shapeClass: TrainingShapeClass,
  elapsedSec: number
): { bests: TrainingSpeedBests; shapeBest: boolean; overallBest: boolean } {
  const next: TrainingSpeedBests = {
    overallSec: bests.overallSec,
    byShape: { ...bests.byShape },
  };

  let shapeBest = false;
  const prevShape = next.byShape[shapeClass];
  if (prevShape == null || elapsedSec < prevShape) {
    next.byShape[shapeClass] = elapsedSec;
    shapeBest = true;
  }

  let overallBest = false;
  if (next.overallSec == null || elapsedSec < next.overallSec) {
    next.overallSec = elapsedSec;
    overallBest = true;
  }

  saveTrainingSpeedBests(next);
  return { bests: next, shapeBest, overallBest };
}

export function formatElapsedSeconds(totalSec: number): string {
  const clamped = Math.max(0, totalSec);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped - minutes * 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
  }
  return `${seconds.toFixed(1)}s`;
}

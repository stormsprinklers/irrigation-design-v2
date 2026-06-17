"use client";

import {
  TRAINING_SHAPE_CLASSES,
  TRAINING_SHAPE_LABELS,
  type TrainingExampleStats,
} from "@/lib/domain/training/types";

type Props = {
  stats: TrainingExampleStats;
};

export function TrainingStatsPanel({ stats }: Props) {
  const shapesWithCounts = TRAINING_SHAPE_CLASSES.filter(
    (shape) => stats.byShape[shape] > 0
  );

  return (
    <div className="border-t px-4 py-3" data-tour="training-tour-stats">
      <div className="text-sm font-medium">Your corrections</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.total}</div>
      <p className="text-xs text-muted-foreground">Approved training examples</p>
      {stats.needsRescore > 0 && (
        <p className="mt-1 text-xs text-amber-700">
          {stats.needsRescore} need re-scoring for the current precip curve
        </p>
      )}
      {stats.trainingReady > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {stats.trainingReady} training-ready
        </p>
      )}

      {stats.total > 0 && (
        <ul className="mt-3 space-y-1">
          {shapesWithCounts.map((shape) => (
            <li
              key={shape}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-muted-foreground">
                {TRAINING_SHAPE_LABELS[shape]}
              </span>
              <span className="font-medium tabular-nums">{stats.byShape[shape]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

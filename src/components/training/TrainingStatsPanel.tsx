"use client";

import type { TrainingExampleStats } from "@/lib/domain/training/types";

type Props = {
  stats: TrainingExampleStats;
};

export function TrainingStatsPanel({ stats }: Props) {
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
    </div>
  );
}

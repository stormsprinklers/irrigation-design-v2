"use client";

import { CheckCircle2, Circle, Lock, Trophy } from "lucide-react";
import type { TrainingProgressView } from "@/lib/domain/training/gamification";
import { ACHIEVEMENTS } from "@/lib/domain/training/achievements";
import {
  TRAINING_SHAPE_CLASSES,
  TRAINING_SHAPE_LABELS,
  type TrainingExampleStats,
  type TrainingShapeClass,
} from "@/lib/domain/training/types";
import { shapeMasteryState } from "@/lib/domain/training/gamification";
import { cn } from "@/lib/utils";

type Props = {
  progress: TrainingProgressView;
  stats: TrainingExampleStats;
};

const SHAPE_SHORT: Record<TrainingShapeClass, string> = {
  rectangle: "Rect",
  l_shape: "L",
  narrow_strip: "Strip",
  concave: "Notch",
  front_yard: "Front",
  back_yard: "Back",
  irregular: "Irr.",
};

export function TrainingMasteryPanel({ progress, stats }: Props) {
  const unlocked = new Set(progress.unlockedAchievements);

  return (
    <div className="space-y-4 border-t px-4 py-3" data-tour="training-tour-stats">
      <div>
        <div className="text-sm font-medium">Shape mastery</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Correct each lawn type 3+ times to master it
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {TRAINING_SHAPE_CLASSES.map((shape) => {
            const count = progress.shapeApprovals[shape];
            const status = shapeMasteryState(count);
            return (
              <div
                key={shape}
                title={`${TRAINING_SHAPE_LABELS[shape]}: ${count} saved`}
                className={cn(
                  "flex flex-col items-center rounded-md border px-1 py-2 text-center text-[10px]",
                  status === "mastered" && "border-primary/40 bg-primary/10",
                  status === "in_progress" && "border-amber-500/40 bg-amber-500/5",
                  status === "locked" && "border-dashed opacity-60"
                )}
              >
                {status === "locked" ? (
                  <Lock className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                ) : status === "mastered" ? (
                  <CheckCircle2 className="mb-1 h-3.5 w-3.5 text-primary" />
                ) : (
                  <Circle className="mb-1 h-3.5 w-3.5 text-amber-600" />
                )}
                <span className="font-medium leading-tight">{SHAPE_SHORT[shape]}</span>
                <span className="tabular-nums text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
        {progress.suggestedShape && (
          <p className="mt-2 text-xs text-muted-foreground">
            Try next: <span className="font-medium text-foreground">{TRAINING_SHAPE_LABELS[progress.suggestedShape]}</span>
          </p>
        )}
      </div>

      {progress.dailyQuest && progress.dailyQuestLabel && (
        <div
          className={cn(
            "rounded-md border px-3 py-2",
            progress.dailyQuestCompleted ? "border-primary/30 bg-primary/5" : "bg-muted/30"
          )}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Daily quest
          </div>
          <p className="mt-1 text-sm">{progress.dailyQuestLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {progress.dailyQuestCompleted ? "Completed today" : "+25 XP when complete"}
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Trophy className="h-4 w-4" />
          Achievements
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map((achievement) => {
            const earned = unlocked.has(achievement.id);
            return (
              <div
                key={achievement.id}
                className={cn(
                  "rounded-md border px-2 py-1.5",
                  earned ? "border-primary/30 bg-primary/5" : "opacity-50"
                )}
                title={achievement.description}
              >
                <div className="text-xs font-medium leading-tight">{achievement.title}</div>
                <div className="text-[10px] text-muted-foreground">{achievement.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t pt-3">
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
    </div>
  );
}

"use client";

import { useState } from "react";
import { Flame, Settings2 } from "lucide-react";
import type { TrainingProgressView } from "@/lib/domain/training/gamification";
import { updateTrainingDailyGoal } from "@/lib/actions/training";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type Props = {
  progress: TrainingProgressView;
  onProgressChange: (progress: TrainingProgressView) => void;
};

function DailyRing({ value, goal }: { value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative flex h-11 w-11 items-center justify-center" title="Daily goal">
      <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-[stroke-dashoffset]"
        />
      </svg>
      <span className="absolute text-[10px] font-semibold tabular-nums">
        {value}/{goal}
      </span>
    </div>
  );
}

export function TrainingProgressHeader({ progress, onProgressChange }: Props) {
  const [open, setOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(progress.dailyGoal));
  const [saving, setSaving] = useState(false);

  async function saveGoal() {
    setSaving(true);
    try {
      const next = await updateTrainingDailyGoal(Number(goalDraft));
      onProgressChange(next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-3 py-2 sm:px-4"
      data-tour="training-tour-progress"
    >
      {progress.streak > 0 && (
        <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-1 text-sm font-medium text-orange-700 dark:text-orange-300">
          <Flame className="h-4 w-4" aria-hidden />
          <span className="tabular-nums">{progress.streak}</span>
          <span className="sr-only">day streak</span>
        </div>
      )}

      <DailyRing value={progress.dailyApprovalsToday} goal={progress.dailyGoal} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium">
            Lv {progress.level} · {progress.levelTitle}
          </span>
          <span className="tabular-nums text-muted-foreground">{progress.xp} XP</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress.xpProgressPercent}%` }}
          />
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Training goals">
            <Settings2 className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[min(100vw,20rem)]">
          <SheetHeader>
            <SheetTitle>Daily goal</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Label htmlFor="daily-goal" className="text-sm">
              Corrections per day
            </Label>
            <NativeSelect
              id="daily-goal"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} per day
                </option>
              ))}
            </NativeSelect>
            <Button className="w-full" onClick={saveGoal} disabled={saving}>
              {saving ? "Saving…" : "Save goal"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function TrainingProgressHeaderCompact({
  progress,
  className,
}: {
  progress: TrainingProgressView;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      {progress.streak > 0 && (
        <span className="inline-flex items-center gap-0.5 font-medium text-orange-700 dark:text-orange-300">
          <Flame className="h-3.5 w-3.5" />
          {progress.streak}
        </span>
      )}
      <span className="tabular-nums">
        {progress.dailyApprovalsToday}/{progress.dailyGoal} today
      </span>
      <span>·</span>
      <span>Lv {progress.level}</span>
    </div>
  );
}

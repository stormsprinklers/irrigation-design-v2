import type { ApproveTrainingResult } from "@/lib/actions/training";
import { ACHIEVEMENT_BY_ID } from "@/lib/domain/training/achievements";
import { toast } from "sonner";

export function showTrainingApproveCelebration(result: ApproveTrainingResult) {
  const lines: string[] = [`+${result.xpGained} XP`];

  if (result.leveledUp) {
    lines.push(`Level up! Now level ${result.newLevel}`);
  }
  if (result.dailyGoalJustCompleted) {
    lines.push("Daily goal complete (+20 XP)");
  }
  if (result.dailyQuestJustCompleted) {
    lines.push("Daily quest complete (+25 XP)");
  }
  if (result.streakIncreased && result.progress.streak > 1) {
    lines.push(`${result.progress.streak}-day streak`);
  }

  const achievementNames = result.achievementsUnlocked
    .map((id) => ACHIEVEMENT_BY_ID[id]?.title)
    .filter(Boolean);

  if (achievementNames.length > 0) {
    lines.push(`Unlocked: ${achievementNames.join(", ")}`);
  }

  const description = lines.slice(1).join(" · ");

  if (result.leveledUp || result.achievementsUnlocked.length > 0) {
    toast.success(lines[0], {
      description: description || undefined,
      duration: 5000,
    });
  } else {
    toast.success(lines[0], {
      description: description || undefined,
      duration: 3500,
    });
  }
}

import type { TrainingShapeClass } from "./types";

export type AchievementDef = {
  id: string;
  title: string;
  description: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_correction", title: "First correction", description: "Save your first training example" },
  { id: "streak_3", title: "On a roll", description: "3-day streak" },
  { id: "streak_7", title: "Week warrior", description: "7-day streak" },
  { id: "streak_30", title: "Dedicated", description: "30-day streak" },
  { id: "shape_rectangle", title: "Rectangle ranger", description: "Correct a rectangle lawn" },
  { id: "shape_l_shape", title: "L-shape learner", description: "Correct an L-shape lawn" },
  { id: "shape_narrow_strip", title: "Strip specialist", description: "Correct a narrow strip" },
  { id: "shape_concave", title: "Notch navigator", description: "Correct a concave lawn" },
  { id: "shape_front_yard", title: "Front yard pro", description: "Correct a front yard" },
  { id: "shape_back_yard", title: "Back yard pro", description: "Correct a back yard" },
  { id: "shape_irregular", title: "Irregular ace", description: "Correct an irregular lawn" },
  { id: "shape_collector", title: "Shape collector", description: "Correct all 7 lawn shapes" },
  { id: "big_improvement", title: "Big improvement", description: "Score +15 improvement on one layout" },
  { id: "dry_spot_fixer", title: "Dry spot fixer", description: "Reduce dry spots vs the algorithm" },
  { id: "heavy_editor", title: "Heavy editor", description: "Move 5+ heads in one correction" },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a])
) as Record<string, AchievementDef>;

export function shapeAchievementId(shape: TrainingShapeClass): string {
  return `shape_${shape}`;
}

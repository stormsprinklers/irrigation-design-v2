import { TRAINING_SHAPE_CLASSES, type TrainingShapeClass } from "./types";

export function emptyShapeCounts(): Record<TrainingShapeClass, number> {
  return Object.fromEntries(
    TRAINING_SHAPE_CLASSES.map((shape) => [shape, 0])
  ) as Record<TrainingShapeClass, number>;
}

/**
 * Pick a lawn shape for random generation, weighted toward shapes with fewer
 * saved corrections. Weight = 1 / (count + 1) so zero-count shapes are
 * favored but well-covered shapes still appear occasionally.
 */
export function pickWeightedUnderrepresentedShape(
  counts: Record<TrainingShapeClass, number>,
  rng: () => number = Math.random
): TrainingShapeClass {
  let total = 0;
  const weights = TRAINING_SHAPE_CLASSES.map((shape) => {
    const w = 1 / (counts[shape] + 1);
    total += w;
    return w;
  });

  let roll = rng() * total;
  for (let i = 0; i < TRAINING_SHAPE_CLASSES.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return TRAINING_SHAPE_CLASSES[i]!;
  }
  return TRAINING_SHAPE_CLASSES[TRAINING_SHAPE_CLASSES.length - 1]!;
}

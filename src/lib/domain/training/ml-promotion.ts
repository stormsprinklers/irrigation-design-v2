/** Promotion gate checks for ML model deployment. */
export type MlEvalMetrics = {
  n_examples?: number;
  position_mae_ft_mean?: number;
  position_mae_ft_median?: number;
  baseline_position_mae_ft_mean?: number;
  model_position_mae_ft_mean?: number;
  model_beats_baseline_mae?: boolean;
  head_count_delta_mean?: number;
  delete_f1_mean?: number;
  median_improvement_score_in_dataset?: number;
};

export type PromotionGateResult = {
  passed: boolean;
  reasons: string[];
};

const MAX_HEAD_COUNT_DELTA = 2.0;

export function evaluatePromotionGates(metrics: MlEvalMetrics): PromotionGateResult {
  const reasons: string[] = [];

  if ((metrics.n_examples ?? 0) < 10) {
    reasons.push("Fewer than 10 test examples");
  }

  if (!metrics.model_beats_baseline_mae) {
    reasons.push("Model position MAE does not beat baseline");
  }

  if (
    metrics.model_position_mae_ft_mean != null &&
    metrics.baseline_position_mae_ft_mean != null &&
    metrics.model_position_mae_ft_mean >= metrics.baseline_position_mae_ft_mean
  ) {
    reasons.push("Model mean position MAE >= baseline mean");
  }

  if ((metrics.head_count_delta_mean ?? 0) > MAX_HEAD_COUNT_DELTA) {
    reasons.push(`Head count delta mean exceeds ${MAX_HEAD_COUNT_DELTA}`);
  }

  return { passed: reasons.length === 0, reasons };
}

export function parseEvalMetricsJson(raw: unknown): MlEvalMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as MlEvalMetrics;
}

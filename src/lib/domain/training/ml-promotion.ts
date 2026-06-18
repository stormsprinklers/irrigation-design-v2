/** Promotion gate checks for ML model deployment (sanity checks only — metrics are advisory). */
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
  warnings: string[];
};

/** Reject only runaway head-count predictions that could hang inference. */
export const MAX_HEAD_COUNT_DELTA = 30;

export function evaluatePromotionGates(metrics: MlEvalMetrics): PromotionGateResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if ((metrics.n_examples ?? 0) < 1) {
    reasons.push("No evaluation examples in export");
  }

  if ((metrics.head_count_delta_mean ?? 0) > MAX_HEAD_COUNT_DELTA) {
    reasons.push(`Head count delta mean exceeds ${MAX_HEAD_COUNT_DELTA}`);
  }

  if (!metrics.model_beats_baseline_mae) {
    warnings.push("Model position MAE does not beat baseline (informational only)");
  }

  if (
    metrics.model_position_mae_ft_mean != null &&
    metrics.baseline_position_mae_ft_mean != null &&
    metrics.model_position_mae_ft_mean >= metrics.baseline_position_mae_ft_mean
  ) {
    warnings.push("Model mean position MAE >= baseline mean (informational only)");
  }

  return { passed: reasons.length === 0, reasons, warnings };
}

export function parseEvalMetricsJson(raw: unknown): MlEvalMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as MlEvalMetrics;
}

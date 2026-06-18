#!/usr/bin/env node
/**
 * Sanity-check eval metrics before deploy. Exits 0 unless head-count or empty export.
 * MAE / baseline comparison is logged as warnings only — not a deploy blocker.
 *
 * Usage: node scripts/ml-check-promotion.mjs path/to/eval_metrics.json
 */
import { readFileSync } from "node:fs";

const MAX_HEAD_COUNT_DELTA = Number(process.env.ML_MAX_HEAD_COUNT_DELTA ?? 30);

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/ml-check-promotion.mjs <eval_metrics.json>");
  process.exit(1);
}

const metrics = JSON.parse(readFileSync(path, "utf8"));
const reasons = [];
const warnings = [];

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

const passed = reasons.length === 0;
const result = { passed, reasons, warnings, metrics };
console.log(JSON.stringify(result, null, 2));
for (const w of warnings) {
  console.warn(`::notice:: ${w}`);
}
process.exit(passed ? 0 : 1);

#!/usr/bin/env node
/**
 * Check eval metrics against promotion gates.
 * Exits 0 if promotion passed, 1 otherwise.
 *
 * Usage: node scripts/ml-check-promotion.mjs path/to/eval_metrics.json
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/ml-check-promotion.mjs <eval_metrics.json>");
  process.exit(1);
}

const metrics = JSON.parse(readFileSync(path, "utf8"));
const reasons = [];

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
if ((metrics.head_count_delta_mean ?? 0) > 2) {
  reasons.push("Head count delta mean exceeds 2");
}

const passed = reasons.length === 0;
const result = { passed, reasons, metrics };
console.log(JSON.stringify(result, null, 2));
process.exit(passed ? 0 : 1);

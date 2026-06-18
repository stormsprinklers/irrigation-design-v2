import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluatePromotionGates } from "../ml-promotion";

describe("ml-promotion", () => {
  it("passes when model beats baseline with enough examples", () => {
    const result = evaluatePromotionGates({
      n_examples: 20,
      model_beats_baseline_mae: true,
      baseline_position_mae_ft_mean: 2.5,
      model_position_mae_ft_mean: 1.8,
      head_count_delta_mean: 0.5,
    });
    assert.equal(result.passed, true);
    assert.equal(result.reasons.length, 0);
  });

  it("fails when model does not beat baseline", () => {
    const result = evaluatePromotionGates({
      n_examples: 20,
      model_beats_baseline_mae: false,
      baseline_position_mae_ft_mean: 1.5,
      model_position_mae_ft_mean: 2.0,
      head_count_delta_mean: 0.5,
    });
    assert.equal(result.passed, false);
    assert.ok(result.reasons.length > 0);
  });
});

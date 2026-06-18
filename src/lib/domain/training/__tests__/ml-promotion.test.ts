import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluatePromotionGates } from "../ml-promotion";

describe("ml-promotion", () => {
  it("passes when model has examples and head count delta is reasonable", () => {
    const result = evaluatePromotionGates({
      n_examples: 50,
      model_beats_baseline_mae: false,
      baseline_position_mae_ft_mean: 2.5,
      model_position_mae_ft_mean: 3.0,
      head_count_delta_mean: 10,
    });
    assert.equal(result.passed, true);
    assert.equal(result.reasons.length, 0);
    assert.ok(result.warnings.length > 0);
  });

  it("fails only on empty eval or extreme head count delta", () => {
    const empty = evaluatePromotionGates({
      n_examples: 0,
      head_count_delta_mean: 0,
    });
    assert.equal(empty.passed, false);
    assert.ok(empty.reasons.some((r) => r.includes("No evaluation")));

    const runaway = evaluatePromotionGates({
      n_examples: 50,
      head_count_delta_mean: 35,
    });
    assert.equal(runaway.passed, false);
    assert.ok(runaway.reasons.some((r) => r.includes("Head count delta")));
  });
});

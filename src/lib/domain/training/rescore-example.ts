import {
  computeImprovementScore,
  evaluateDesign,
} from "../simulation/scoring";
import {
  CURRENT_DISTRIBUTION_CURVE_VERSION,
  type DistributionCurveVersion,
} from "../simulation/radial-curve";
import type { TrainingExamplePayload } from "./types";

export function rescoreTrainingExamplePayload(
  payload: TrainingExamplePayload,
  curveVersion: DistributionCurveVersion = CURRENT_DISTRIBUTION_CURVE_VERSION
): TrainingExamplePayload {
  const evalOpts = {
    exclusionZones: payload.exclusionZonesFt ?? [],
    distributionCurveVersion: curveVersion,
  };

  const baselineEval = evaluateDesign(
    payload.polygonVerticesFt,
    payload.algorithmOutput,
    1.5,
    evalOpts
  );
  const correctedEval = evaluateDesign(
    payload.polygonVerticesFt,
    payload.approvedOutput,
    1.5,
    evalOpts
  );

  return {
    ...payload,
    originalScores: baselineEval.scores,
    approvedScores: correctedEval.scores,
    originalPrecipGrid: baselineEval.grid,
    approvedPrecipGrid: correctedEval.grid,
    improvementScore: computeImprovementScore(
      baselineEval.scores,
      correctedEval.scores
    ),
    distributionCurveVersion: curveVersion,
    validForTraining: true,
    needsRescore: false,
  };
}

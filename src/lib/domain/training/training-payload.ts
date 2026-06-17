import {
  CURRENT_DISTRIBUTION_CURVE_VERSION,
  LEGACY_DISTRIBUTION_CURVE_VERSION,
} from "../simulation/radial-curve";
import type { TrainingExamplePayload } from "./types";

/** Annotate stored payloads without mutating head layouts or historical scores on disk. */
export function annotateTrainingPayload(
  payload: TrainingExamplePayload
): TrainingExamplePayload {
  const version = payload.distributionCurveVersion;

  if (version === CURRENT_DISTRIBUTION_CURVE_VERSION) {
    return {
      ...payload,
      validForTraining: payload.validForTraining ?? true,
      needsRescore: payload.needsRescore ?? false,
    };
  }

  return {
    ...payload,
    distributionCurveVersion: version ?? LEGACY_DISTRIBUTION_CURVE_VERSION,
    validForTraining: false,
    needsRescore: true,
  };
}

export function payloadNeedsRescore(payload: TrainingExamplePayload): boolean {
  return annotateTrainingPayload(payload).needsRescore === true;
}

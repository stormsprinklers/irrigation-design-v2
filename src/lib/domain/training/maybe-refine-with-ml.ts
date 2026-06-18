import type { CatalogItemData } from "../types";
import type { TrainingHeadSnapshot, TrainingPlacementContext } from "./types";
import type { GeneratedTrainingPolygon } from "./types";
import {
  callMlRefineApi,
  getMlRefineClientConfig,
  isPlacementMlEnabled,
  isPlacementMlShadow,
  type MlRefineDiagnostics,
} from "./ml-refine-client";
import { mlRefineRequestFromPlacement } from "./ml-features";
import { postprocessRefinedHeads } from "../placement/refine-postprocess";

export type MaybeRefineWithMlInput = {
  polygon: Pick<GeneratedTrainingPolygon, "verticesFt" | "metadata">;
  baselineHeads: TrainingHeadSnapshot[];
  placementContext: TrainingPlacementContext;
  catalog: CatalogItemData[];
  forceMl?: boolean;
  shadowOnly?: boolean;
};

export type MaybeRefineWithMlResult = {
  heads: TrainingHeadSnapshot[];
  usedMl: boolean;
  shadowOnly: boolean;
  diagnostics?: MlRefineDiagnostics;
  error?: string;
};

export async function maybeRefineWithMl(
  input: MaybeRefineWithMlInput
): Promise<MaybeRefineWithMlResult> {
  const enabled = input.forceMl ?? isPlacementMlEnabled();
  const shadow = input.shadowOnly ?? isPlacementMlShadow();
  const config = getMlRefineClientConfig();

  if (!enabled && !shadow) {
    return { heads: input.baselineHeads, usedMl: false, shadowOnly: false };
  }
  if (!config) {
    return {
      heads: input.baselineHeads,
      usedMl: false,
      shadowOnly: shadow,
      error: "ML_INFERENCE_URL not configured",
    };
  }

  try {
    const request = mlRefineRequestFromPlacement({
      polygonVerticesFt: input.polygon.verticesFt,
      shapeClass: input.polygon.metadata.shapeClass,
      placementContext: input.placementContext,
      baselineHeads: input.baselineHeads,
      modelVersion: config.modelVersion,
    });

    const response = await callMlRefineApi(request, config);
    const refined = postprocessRefinedHeads({
      polygonVerticesFt: input.polygon.verticesFt,
      baselineHeads: input.baselineHeads,
      refinedHeads: response.refinedHeads,
      deletedIds: response.diagnostics.deletedIds,
      catalog: input.catalog,
    });

    if (shadow && !enabled) {
      return {
        heads: input.baselineHeads,
        usedMl: true,
        shadowOnly: true,
        diagnostics: response.diagnostics,
      };
    }

    return {
      heads: refined,
      usedMl: true,
      shadowOnly: false,
      diagnostics: response.diagnostics,
    };
  } catch (err) {
    return {
      heads: input.baselineHeads,
      usedMl: false,
      shadowOnly: shadow,
      error: err instanceof Error ? err.message : "ML refine failed",
    };
  }
}

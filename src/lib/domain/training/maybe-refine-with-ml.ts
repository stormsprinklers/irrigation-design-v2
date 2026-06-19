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
import { resolveDefaultHeadSettings, wedgeBoundsForHead, clampHeadToNozzle, patchHeadWithNozzle } from "@/lib/catalog/adjustability";
import { stripFieldsFromNozzle } from "@/lib/catalog/strip-pattern";
import { getHeadBodies, nozzleCompatibleWithHead } from "@/lib/catalog/compat";

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

function resolveHeadBodyId(
  catalog: CatalogItemData[],
  nozzle: CatalogItemData,
  preferredBodyId?: string | null
): string | undefined {
  if (preferredBodyId) {
    const preferred = catalog.find((c) => c.id === preferredBodyId);
    if (preferred && nozzleCompatibleWithHead(nozzle, preferred)) {
      return preferredBodyId;
    }
  }
  for (const body of getHeadBodies(catalog)) {
    if (nozzleCompatibleWithHead(nozzle, body)) {
      return body.id;
    }
  }
  return undefined;
}

function hydratePlacedHeads(
  heads: TrainingHeadSnapshot[],
  catalog: CatalogItemData[],
  placementContext: TrainingPlacementContext
): TrainingHeadSnapshot[] {
  const pressure = placementContext.pressurePsi ?? 65;
  const fallbackNozzleId = placementContext.catalogItemIds[0];

  return heads.map((head) => {
    const nozzleId =
      head.catalogItemId && catalog.some((c) => c.id === head.catalogItemId)
        ? head.catalogItemId
        : fallbackNozzleId;
    const nozzle = catalog.find((c) => c.id === nozzleId);
    if (!nozzle) return head;

    const headBodyId = resolveHeadBodyId(catalog, nozzle, head.headBodyId);
    const defaults = resolveDefaultHeadSettings(nozzle, pressure);

    const geometry = clampHeadToNozzle(
      {
        arcDegrees: head.arcDegrees > 0 ? head.arcDegrees : defaults.arcDegrees,
        radiusFeet: head.radiusFeet > 0 ? head.radiusFeet : defaults.radiusFeet,
        rotationDegrees: head.rotationDegrees ?? defaults.rotationDegrees,
      },
      nozzle
    );

    const hyd = patchHeadWithNozzle(
      {
        arcDegrees: geometry.arcDegrees,
        radiusFeet: geometry.radiusFeet,
        rotationDegrees: geometry.rotationDegrees,
        gpm: defaults.gpm,
        precipInPerHr: defaults.precipInPerHr,
      },
      {},
      nozzle,
      pressure
    );

    const merged: TrainingHeadSnapshot = {
      ...head,
      headBodyId,
      catalogItemId: nozzleId,
      nozzleModel: nozzle.model,
      ...geometry,
      gpm: hyd.gpm,
      precipInPerHr: hyd.precipInPerHr,
      ...stripFieldsFromNozzle(nozzle),
    };
    return { ...merged, ...wedgeBoundsForHead(merged) };
  });
}

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

    const hydrated = hydratePlacedHeads(refined, input.catalog, input.placementContext);

    const baselineCount = input.baselineHeads.length;
    const minRetained = Math.max(1, Math.ceil(baselineCount * 0.15));
    if (hydrated.length < minRetained) {
      return {
        heads: input.baselineHeads,
        usedMl: false,
        shadowOnly: shadow,
        diagnostics: response.diagnostics,
        error: `ML placed only ${hydrated.length} head(s); using heuristic layout`,
      };
    }

    if (shadow && !enabled) {
      return {
        heads: input.baselineHeads,
        usedMl: true,
        shadowOnly: true,
        diagnostics: response.diagnostics,
      };
    }

    return {
      heads: hydrated,
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

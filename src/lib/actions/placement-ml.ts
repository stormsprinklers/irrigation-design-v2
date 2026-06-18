"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CatalogItemData, HydrozonePolygon, SprinklerHead } from "@/lib/domain/types";
import { maybeRefineWithMl } from "@/lib/domain/training/maybe-refine-with-ml";
import type {
  TrainingHeadSnapshot,
  TrainingPlacementContext,
  TrainingShapeClass,
} from "@/lib/domain/training/types";
import { postprocessRefinedHeads } from "@/lib/domain/placement/refine-postprocess";
import { snapshotsToSprinklerHeads } from "@/lib/domain/training/placement-adapter";
import {
  evaluatePromotionGates,
  parseEvalMetricsJson,
  type MlEvalMetrics,
} from "@/lib/domain/training/ml-promotion";
import {
  checkMlServiceHealth,
  isPlacementMlEnabled,
} from "@/lib/domain/training/ml-refine-client";

export type RefinePlacementInput = {
  polygonVerticesFt: { x: number; y: number }[];
  shapeClass?: TrainingShapeClass;
  baselineHeads: TrainingHeadSnapshot[];
  placementContext: TrainingPlacementContext;
  catalog?: CatalogItemData[];
  forceMl?: boolean;
  shadowOnly?: boolean;
  source?: "training" | "design";
  projectId?: string;
};

export type RefinePlacementResult = {
  heads: TrainingHeadSnapshot[];
  usedMl: boolean;
  shadowOnly: boolean;
  error?: string;
};

async function logInference(input: {
  organizationId: string;
  userId?: string;
  source: string;
  modelVersion?: string;
  usedMl: boolean;
  shadowOnly: boolean;
  baselineHeadCount: number;
  refinedHeadCount: number;
  meanConfidence?: number;
  error?: string;
  diagnostics?: unknown;
}) {
  try {
    await prisma.placementInferenceLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        source: input.source,
        modelVersion: input.modelVersion ?? process.env.ML_MODEL_VERSION,
        usedMl: input.usedMl,
        shadowOnly: input.shadowOnly,
        baselineHeadCount: input.baselineHeadCount,
        refinedHeadCount: input.refinedHeadCount,
        meanConfidence: input.meanConfidence,
        error: input.error,
        diagnostics: input.diagnostics as object | undefined,
      },
    });
  } catch (err) {
    console.error("Failed to log placement inference", err);
  }
}

export async function refinePlacementWithMl(
  input: RefinePlacementInput
): Promise<RefinePlacementResult> {
  const session = await auth();
  const organizationId = session?.user?.organizationId;

  const result = await maybeRefineWithMl({
    polygon: {
      verticesFt: input.polygonVerticesFt,
      metadata: {
        shapeClass: input.shapeClass ?? "rectangle",
        seed: 0,
        widthFt: 0,
        heightFt: 0,
        areaSqFt: 0,
        vertexCount: input.polygonVerticesFt.length,
        sideLengthsFt: [],
        hasExclusions: false,
        rotationDeg: 0,
      },
    },
    baselineHeads: input.baselineHeads,
    placementContext: input.placementContext,
    catalog: input.catalog ?? [],
    forceMl: input.forceMl,
    shadowOnly: input.shadowOnly,
  });

  if (organizationId) {
    await logInference({
      organizationId,
      userId: session?.user?.id,
      source: input.source ?? "unknown",
      usedMl: result.usedMl,
      shadowOnly: result.shadowOnly,
      baselineHeadCount: input.baselineHeads.length,
      refinedHeadCount: result.heads.length,
      meanConfidence: result.diagnostics?.meanConfidence,
      error: result.error,
      diagnostics: result.diagnostics,
    });
  }

  return {
    heads: result.heads,
    usedMl: result.usedMl,
    shadowOnly: result.shadowOnly,
    error: result.error,
  };
}

export async function refineDesignHeadsWithMl(input: {
  hydrozone: HydrozonePolygon;
  zoneId: string;
  baselineHeads: SprinklerHead[];
  catalog: CatalogItemData[];
  placementContext: TrainingPlacementContext;
  forceMl?: boolean;
}): Promise<{ heads: SprinklerHead[]; usedMl: boolean; error?: string }> {
  const snapshots: TrainingHeadSnapshot[] = input.baselineHeads.map((h) => ({
    id: h.id,
    positionFt: { x: h.position.x, y: h.position.y },
    radiusFeet: h.radiusFeet,
    arcDegrees: h.arcDegrees,
    rotationDegrees: h.rotationDegrees,
    wedgeStartDeg: 0,
    wedgeEndDeg: h.arcDegrees,
    catalogItemId: h.catalogItemId,
    headBodyId: h.headBodyId,
    gpm: h.gpm,
    precipInPerHr: h.precipInPerHr,
  }));

  const result = await maybeRefineWithMl({
    polygon: {
      verticesFt: input.hydrozone.vertices,
      metadata: {
        shapeClass: "irregular",
        seed: 0,
        widthFt: 0,
        heightFt: 0,
        areaSqFt: 0,
        vertexCount: input.hydrozone.vertices.length,
        sideLengthsFt: [],
        hasExclusions: false,
        rotationDeg: 0,
      },
    },
    baselineHeads: snapshots,
    placementContext: input.placementContext,
    catalog: input.catalog,
    forceMl: input.forceMl ?? isPlacementMlEnabled(),
  });

  const refined = postprocessRefinedHeads({
    polygonVerticesFt: input.hydrozone.vertices,
    baselineHeads: snapshots,
    refinedHeads: result.heads,
    deletedIds: result.diagnostics?.deletedIds ?? [],
    catalog: input.catalog,
  });

  const sprinklerHeads = snapshotsToSprinklerHeads(
    refined,
    input.zoneId,
    input.hydrozone.id
  );

  const session = await auth();
  if (session?.user?.organizationId) {
    await logInference({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      source: "design",
      usedMl: result.usedMl,
      shadowOnly: false,
      baselineHeadCount: snapshots.length,
      refinedHeadCount: refined.length,
      meanConfidence: result.diagnostics?.meanConfidence,
      error: result.error,
      diagnostics: result.diagnostics,
    });
  }

  return { heads: sprinklerHeads, usedMl: result.usedMl, error: result.error };
}

export type PlacementMlStatus = Awaited<ReturnType<typeof getPlacementMlStatus>>;

export async function getPlacementMlStatus() {
  const health = await checkMlServiceHealth();
  const activeModel = await prisma.placementModelVersion.findFirst({
    where: { isActive: true },
    orderBy: { trainedAt: "desc" },
  });

  return {
    enabled: isPlacementMlEnabled(),
    serviceHealthy: health.ok,
    modelLoaded: health.modelLoaded ?? false,
    modelVersion: health.modelVersion ?? activeModel?.version ?? null,
    activeModel: activeModel
      ? {
          id: activeModel.id,
          version: activeModel.version,
          algorithmVersion: activeModel.algorithmVersion,
          trainedAt: activeModel.trainedAt.toISOString(),
          promotionPassed: activeModel.promotionPassed,
        }
      : null,
  };
}

export async function registerPlacementModelVersion(input: {
  version: string;
  checkpointUrl: string;
  algorithmVersion: string;
  metrics: MlEvalMetrics;
  setActive?: boolean;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const gate = evaluatePromotionGates(input.metrics);

  if (input.setActive) {
    await prisma.placementModelVersion.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  }

  const row = await prisma.placementModelVersion.create({
    data: {
      version: input.version,
      checkpointUrl: input.checkpointUrl,
      algorithmVersion: input.algorithmVersion,
      metricsJson: input.metrics as object,
      promotionPassed: gate.passed,
      promotionNotes: gate.reasons.join("; ") || null,
      isActive: input.setActive ?? gate.passed,
    },
  });

  return { id: row.id, promotionPassed: gate.passed, reasons: gate.reasons };
}

export async function getLatestEvalMetrics(): Promise<MlEvalMetrics | null> {
  const row = await prisma.placementModelVersion.findFirst({
    orderBy: { trainedAt: "desc" },
    select: { metricsJson: true },
  });
  return parseEvalMetricsJson(row?.metricsJson);
}

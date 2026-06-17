"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import {
  approveTrainingExampleSchema,
  exportTrainingExamplesSchema,
} from "@/lib/domain/training/schemas";
import {
  TRAINING_SHAPE_CLASSES,
  type TrainingExampleApprovalInput,
  type TrainingExamplePayload,
  type TrainingExampleStats,
  type TrainingShapeClass,
} from "@/lib/domain/training/types";
import { getPlacementAlgorithmVersion } from "@/lib/domain/training/algorithm-version.server";
import { polygonEdgeLengthsFt, roundLengthFt } from "@/lib/domain/placement/geometry";
import { CURRENT_DISTRIBUTION_CURVE_VERSION } from "@/lib/domain/simulation/radial-curve";
import { rescoreTrainingExamplePayload } from "@/lib/domain/training/rescore-example";
import {
  annotateTrainingPayload,
  payloadNeedsRescore,
} from "@/lib/domain/training/training-payload";
import { revalidatePath } from "next/cache";

type ParsedApprovalPayload = z.infer<typeof approveTrainingExampleSchema>["payload"];

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

function emptyShapeCounts(): Record<TrainingShapeClass, number> {
  return Object.fromEntries(
    TRAINING_SHAPE_CLASSES.map((shape) => [shape, 0])
  ) as Record<TrainingShapeClass, number>;
}

export async function getTrainingExampleStats(): Promise<TrainingExampleStats> {
  const user = await requireSession();
  const rows = await prisma.trainingExample.findMany({
    where: { createdById: user.id, status: "APPROVED" },
    select: { polygonMetadata: true, payload: true },
  });

  const byShape = emptyShapeCounts();
  let needsRescore = 0;
  let trainingReady = 0;

  for (const row of rows) {
    const meta = row.polygonMetadata as { shapeClass?: string };
    const shape = meta.shapeClass;
    if (shape && shape in byShape) {
      byShape[shape as TrainingShapeClass] += 1;
    }

    const payload = annotateTrainingPayload(row.payload as TrainingExamplePayload);
    if (payload.needsRescore) needsRescore++;
    if (payload.validForTraining) trainingReady++;
  }

  return { total: rows.length, byShape, needsRescore, trainingReady };
}

export async function listTrainingExamples(status?: "IN_PROGRESS" | "APPROVED" | "DISCARDED") {
  const user = await requireSession();
  const rows = await prisma.trainingExample.findMany({
    where: {
      organizationId: user.organizationId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      algorithmVersion: true,
      polygonMetadata: true,
      payload: true,
      createdAt: true,
      approvedAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => {
    const annotated = annotateTrainingPayload(row.payload as TrainingExamplePayload);
    return {
      id: row.id,
      status: row.status,
      algorithmVersion: row.algorithmVersion,
      polygonMetadata: row.polygonMetadata,
      createdAt: row.createdAt,
      approvedAt: row.approvedAt,
      createdBy: row.createdBy,
      distributionCurveVersion: annotated.distributionCurveVersion,
      validForTraining: annotated.validForTraining ?? false,
      needsRescore: annotated.needsRescore ?? false,
    };
  });
}

export async function getTrainingExample(id: string) {
  const user = await requireSession();
  const row = await prisma.trainingExample.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!row) throw new Error("Training example not found");
  return row;
}

function normalizePolygonMetadata(
  payload: ParsedApprovalPayload
): TrainingExamplePayload["polygonMetadata"] {
  const { polygonMetadata, polygonVerticesFt } = payload;
  return {
    ...polygonMetadata,
    rotationDeg: polygonMetadata.rotationDeg ?? 0,
    sideLengthsFt:
      polygonMetadata.sideLengthsFt ??
      polygonEdgeLengthsFt(polygonVerticesFt).map(roundLengthFt),
  };
}

export async function approveTrainingExample(
  payload: TrainingExampleApprovalInput
): Promise<{ id: string }> {
  const user = await requireSession();
  const parsed = approveTrainingExampleSchema.parse({ payload });
  const fullPayload: TrainingExamplePayload = {
    ...parsed.payload,
    algorithmVersion: getPlacementAlgorithmVersion(),
    polygonMetadata: normalizePolygonMetadata(parsed.payload),
    distributionCurveVersion:
      parsed.payload.distributionCurveVersion ?? CURRENT_DISTRIBUTION_CURVE_VERSION,
    validForTraining: parsed.payload.validForTraining ?? true,
    needsRescore: parsed.payload.needsRescore ?? false,
  };

  const row = await prisma.trainingExample.create({
    data: {
      organizationId: user.organizationId,
      createdById: user.id,
      status: "APPROVED",
      algorithmVersion: fullPayload.algorithmVersion,
      polygonMetadata: fullPayload.polygonMetadata,
      payload: fullPayload as unknown as Prisma.InputJsonValue,
      approvedAt: new Date(),
    },
  });

  revalidatePath("/training");
  return { id: row.id };
}

export async function rescoreTrainingExample(id: string) {
  const user = await requireSession();
  const row = await prisma.trainingExample.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!row) throw new Error("Training example not found");

  const payload = annotateTrainingPayload(row.payload as TrainingExamplePayload);
  const rescored = rescoreTrainingExamplePayload(payload);

  await prisma.trainingExample.update({
    where: { id: row.id },
    data: { payload: rescored as unknown as Prisma.InputJsonValue },
  });

  revalidatePath("/training");
  return { id: row.id };
}

export async function rescoreStaleTrainingExamples() {
  const user = await requireSession();
  const rows = await prisma.trainingExample.findMany({
    where: { organizationId: user.organizationId, status: "APPROVED" },
    select: { id: true, payload: true },
  });

  let rescored = 0;
  for (const row of rows) {
    const payload = row.payload as TrainingExamplePayload;
    if (!payloadNeedsRescore(payload)) continue;

    const updated = rescoreTrainingExamplePayload(annotateTrainingPayload(payload));
    await prisma.trainingExample.update({
      where: { id: row.id },
      data: { payload: updated as unknown as Prisma.InputJsonValue },
    });
    rescored++;
  }

  revalidatePath("/training");
  return { rescored };
}

export async function discardTrainingExample(id: string) {
  const user = await requireSession();
  await prisma.trainingExample.updateMany({
    where: { id, organizationId: user.organizationId },
    data: { status: "DISCARDED" },
  });
  revalidatePath("/training");
}

export async function exportTrainingExamplesJsonl(input?: {
  status?: "IN_PROGRESS" | "APPROVED" | "DISCARDED";
  limit?: number;
  validForTrainingOnly?: boolean;
}) {
  const user = await requireSession();
  const parsed = exportTrainingExamplesSchema.parse(input ?? {});
  const rows = await prisma.trainingExample.findMany({
    where: {
      organizationId: user.organizationId,
      status: parsed.status ?? "APPROVED",
    },
    orderBy: { createdAt: "asc" },
    take: parsed.limit ?? 1000,
  });

  const lines = rows
    .map((row) => {
      const payload = annotateTrainingPayload(row.payload as TrainingExamplePayload);
      if (parsed.validForTrainingOnly && !payload.validForTraining) return null;
      return JSON.stringify({
        id: row.id,
        organizationId: row.organizationId,
        createdById: row.createdById,
        status: row.status,
        algorithmVersion: row.algorithmVersion,
        distributionCurveVersion: payload.distributionCurveVersion,
        validForTraining: payload.validForTraining ?? false,
        needsRescore: payload.needsRescore ?? false,
        createdAt: row.createdAt.toISOString(),
        approvedAt: row.approvedAt?.toISOString() ?? null,
        payload,
      });
    })
    .filter((line): line is string => line != null);

  return lines.join("\n");
}

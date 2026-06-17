"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  approveTrainingExampleSchema,
  exportTrainingExamplesSchema,
} from "@/lib/domain/training/schemas";
import type { TrainingExampleApprovalInput, TrainingExamplePayload } from "@/lib/domain/training/types";
import { getPlacementAlgorithmVersion } from "@/lib/domain/training/algorithm-version.server";
import { revalidatePath } from "next/cache";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function listTrainingExamples(status?: "IN_PROGRESS" | "APPROVED" | "DISCARDED") {
  const user = await requireSession();
  return prisma.trainingExample.findMany({
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
      createdAt: true,
      approvedAt: true,
      createdBy: { select: { name: true, email: true } },
    },
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

export async function approveTrainingExample(payload: TrainingExampleApprovalInput) {
  const user = await requireSession();
  const parsed = approveTrainingExampleSchema.parse({ payload });
  const fullPayload: TrainingExamplePayload = {
    ...parsed.payload,
    algorithmVersion: getPlacementAlgorithmVersion(),
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

  const lines = rows.map((row) =>
    JSON.stringify({
      id: row.id,
      organizationId: row.organizationId,
      createdById: row.createdById,
      status: row.status,
      algorithmVersion: row.algorithmVersion,
      createdAt: row.createdAt.toISOString(),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      payload: row.payload,
    })
  );

  return lines.join("\n");
}

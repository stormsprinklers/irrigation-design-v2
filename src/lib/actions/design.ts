"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EMPTY_DESIGN_DOCUMENT } from "@/lib/domain/types";
import { designDocumentSchema } from "@/lib/domain/schemas";
import { revalidatePath } from "next/cache";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

async function requireProjectAccess(projectId: string) {
  const user = await requireSession();
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
  });
  if (!project) throw new Error("Project not found");
  return { user, project };
}

export async function listProjects() {
  const user = await requireSession();
  return prisma.project.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: { where: { isActive: true }, take: 1 },
      _count: { select: { versions: true } },
    },
  });
}

export async function createProject(data: {
  name: string;
  customerName?: string;
  address?: string;
}) {
  const user = await requireSession();
  const project = await prisma.project.create({
    data: {
      name: data.name,
      customerName: data.customerName,
      address: data.address,
      organizationId: user.organizationId,
      createdById: user.id,
      versions: {
        create: {
          label: "Initial design",
          kind: "INITIAL",
          isActive: true,
          designData: EMPTY_DESIGN_DOCUMENT,
        },
      },
    },
  });
  revalidatePath("/projects");
  return project;
}

export async function getProject(projectId: string) {
  const { project } = await requireProjectAccess(projectId);
  return project;
}

export async function getActiveDesignVersion(projectId: string) {
  await requireProjectAccess(projectId);
  const version = await prisma.designVersion.findFirst({
    where: { projectId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!version) throw new Error("No active design version");
  return version;
}

export async function getDesignVersions(projectId: string) {
  await requireProjectAccess(projectId);
  return prisma.designVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function saveDesignDocument(
  projectId: string,
  versionId: string,
  designData: unknown
) {
  await requireProjectAccess(projectId);
  const parsed = designDocumentSchema.parse(designData);
  return prisma.designVersion.update({
    where: { id: versionId },
    data: {
      designData: parsed,
      updatedAt: new Date(),
    },
  });
}

export async function createDesignVersion(
  projectId: string,
  data: { label: string; kind: "INITIAL" | "CUSTOMER_REVISION" | "FIELD_ADJUSTMENT" | "AS_BUILT" }
) {
  await requireProjectAccess(projectId);
  const active = await getActiveDesignVersion(projectId);

  await prisma.designVersion.updateMany({
    where: { projectId },
    data: { isActive: false },
  });

  const version = await prisma.designVersion.create({
    data: {
      projectId,
      label: data.label,
      kind: data.kind,
      isActive: true,
      designData: active.designData as object,
    },
  });

  revalidatePath(`/projects/${projectId}/design`);
  return version;
}

export async function activateDesignVersion(projectId: string, versionId: string) {
  await requireProjectAccess(projectId);
  await prisma.designVersion.updateMany({
    where: { projectId },
    data: { isActive: false },
  });
  const version = await prisma.designVersion.update({
    where: { id: versionId },
    data: { isActive: true },
  });
  revalidatePath(`/projects/${projectId}/design`);
  return version;
}

export async function createShareLink(
  projectId: string,
  view: "CUSTOMER" | "INSTALLER"
) {
  await requireProjectAccess(projectId);
  const active = await getActiveDesignVersion(projectId);
  return prisma.designShareLink.create({
    data: {
      projectId,
      view,
      versionId: active.id,
    },
  });
}

export async function getShareLinkByToken(token: string) {
  return prisma.designShareLink.findUnique({
    where: { token },
    include: {
      project: true,
    },
  });
}

export async function getPricingProfile() {
  const user = await requireSession();
  return prisma.pricingProfile.findFirst({
    where: { organizationId: user.organizationId, isDefault: true },
  });
}

export async function updatePricingProfile(data: {
  pipePerFoot: number;
  headCost: number;
  valveCost: number;
  laborMultiplier: number;
  markup: number;
  targetProfitMarginPercent?: number;
  tax: number;
  wasteFactor: number;
}) {
  const user = await requireSession();
  const existing = await prisma.pricingProfile.findFirst({
    where: { organizationId: user.organizationId, isDefault: true },
  });

  if (existing) {
    return prisma.pricingProfile.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.pricingProfile.create({
    data: { organizationId: user.organizationId, isDefault: true, ...data },
  });
}

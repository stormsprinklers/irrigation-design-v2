import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCrmEstimatePayload } from "@/lib/domain/export/crm-estimate";
import { exportEstimateToCrm } from "@/lib/integrations/crm";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, versionId, customerId, propertyId, status } = body;

  if (!projectId || !versionId || !customerId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: session.user.organizationId },
    include: {
      versions: { where: { id: versionId }, take: 1 },
      organization: { include: { pricingProfiles: { where: { isDefault: true }, take: 1 } } },
    },
  });

  if (!project?.versions[0]) {
    return NextResponse.json({ error: "Project or version not found" }, { status: 404 });
  }

  const version = project.versions[0];
  const pricingProfile = project.organization.pricingProfiles[0];
  if (!pricingProfile) {
    return NextResponse.json({ error: "Pricing profile not configured" }, { status: 400 });
  }

  const catalog = await prisma.catalogItem.findMany({
    where: {
      OR: [{ organizationId: null }, { organizationId: session.user.organizationId }],
    },
  });

  const doc = version.designData as object;
  const pricing = {
    pipePerFoot: pricingProfile.pipePerFoot,
    headCost: pricingProfile.headCost,
    valveCost: pricingProfile.valveCost,
    laborMultiplier: pricingProfile.laborMultiplier,
    markup: pricingProfile.markup,
    targetProfitMarginPercent: pricingProfile.targetProfitMarginPercent,
    tax: pricingProfile.tax,
    wasteFactor: pricingProfile.wasteFactor,
    fittingAssumptions: pricingProfile.fittingAssumptions as { elbow?: number },
  };

  const payload = buildCrmEstimatePayload({
    doc: doc as Parameters<typeof buildCrmEstimatePayload>[0]["doc"],
    catalog: catalog.map((c) => ({
      id: c.id,
      manufacturer: c.manufacturer,
      model: c.model,
      category: c.category,
      specs: c.specs as Record<string, unknown>,
    })),
    pricing,
    projectId: project.id,
    projectName: project.name,
    versionId: version.id,
    versionLabel: version.label,
    customerId,
    propertyId: propertyId ?? null,
    status: status === "SENT" ? "SENT" : "DRAFT",
  });

  try {
    const result = await exportEstimateToCrm(payload);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

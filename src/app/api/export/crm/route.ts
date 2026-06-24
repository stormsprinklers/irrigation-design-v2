import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCrmEstimatePayload } from "@/lib/domain/export/crm-estimate";
import { buildInstallerSchematic } from "@/lib/domain/export";
import { calculateZoneHydraulics } from "@/lib/domain/hydraulics/zone";
import { buildInstallerSchematicPdf } from "@/lib/export/schematic-pdf";
import { normalizeDesignDocument } from "@/lib/domain/normalize";
import { exportEstimateToCrm } from "@/lib/integrations/crm";
import { mapPricingProfile } from "@/lib/pricing/map-profile";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, versionId, customerId, propertyId, status } = body;

  const resolvedCustomerId = customerId ?? body.crmCustomerId;
  const resolvedPropertyId = propertyId ?? body.crmPropertyId ?? null;

  if (!projectId || !versionId || !resolvedCustomerId) {
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

  const doc = normalizeDesignDocument(version.designData);
  const pricing = mapPricingProfile(pricingProfile);
  const catalogData = catalog.map((c) => ({
    id: c.id,
    manufacturer: c.manufacturer,
    model: c.model,
    category: c.category,
    specs: c.specs as Record<string, unknown>,
  }));

  const payload = buildCrmEstimatePayload({
    doc,
    catalog: catalogData,
    pricing,
    projectId: project.id,
    projectName: project.name,
    versionId: version.id,
    versionLabel: version.label,
    customerId: resolvedCustomerId,
    propertyId: resolvedPropertyId,
    status: status === "SENT" ? "SENT" : "DRAFT",
    installDurationDays: Number(process.env.DEFAULT_INSTALL_DURATION_DAYS) || 4,
  });

  const schematic = buildInstallerSchematic(doc, catalogData, pricing, (zoneId) => {
    const zone = doc.zones.find((z) => z.id === zoneId);
    if (!zone) return { totalGpm: 0, criticalHeadPressurePsi: 0 };
    const hyd = calculateZoneHydraulics(
      zone,
      doc.heads,
      doc.pipes,
      doc.waterSource,
      catalogData,
      doc.scale
    );
    return { totalGpm: hyd.totalGpm, criticalHeadPressurePsi: hyd.criticalHeadPressurePsi };
  });
  const schematicPdf = buildInstallerSchematicPdf(project.name, schematic);

  const designAttachment = {
    fileName: `${project.name.replace(/[^a-zA-Z0-9._-]/g, "_")}-design.json`,
    mimeType: "application/json",
    base64: Buffer.from(
      JSON.stringify(
        {
          projectName: project.name,
          versionLabel: version.label,
          design: doc,
          exportMetadata: payload.designExportMetadata,
        },
        null,
        2
      )
    ).toString("base64"),
  };

  const schematicAttachment = {
    fileName: `${project.name.replace(/[^a-zA-Z0-9._-]/g, "_")}-schematic.pdf`,
    mimeType: "application/pdf",
    base64: schematicPdf.toString("base64"),
  };

  try {
    const result = await exportEstimateToCrm({
      ...payload,
      attachments: [designAttachment, schematicAttachment],
    });

    if (project.crmCustomerId !== resolvedCustomerId || project.crmPropertyId !== resolvedPropertyId) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          crmCustomerId: resolvedCustomerId,
          crmPropertyId: resolvedPropertyId,
        },
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

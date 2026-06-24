import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShareLinkByToken } from "@/lib/actions/design";
import { getCatalogItems } from "@/lib/catalog";
import { CustomerProposalView } from "@/components/export/CustomerProposalView";
import { InstallerSchematicView } from "@/components/export/InstallerSchematicView";
import { buildCustomerProposal, buildInstallerSchematic } from "@/lib/domain/export";
import { calculateZoneHydraulics } from "@/lib/domain/hydraulics/zone";
import { DEFAULT_PRICING_PROFILE, type DesignDocument } from "@/lib/domain/types";
import { normalizeDesignDocument } from "@/lib/domain/normalize";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) notFound();

  if (link.expiresAt && link.expiresAt < new Date()) notFound();

  const version = link.versionId
    ? await prisma.designVersion.findUnique({ where: { id: link.versionId } })
    : await prisma.designVersion.findFirst({
        where: { projectId: link.projectId, isActive: true },
      });

  if (!version) notFound();

  const doc = normalizeDesignDocument(version.designData);
  const designImageUrl = doc.propertyImage?.blobPath
    ? `/api/share/${token}/property-image`
    : undefined;
  const catalog = await getCatalogItems();
  const pricing = DEFAULT_PRICING_PROFILE;

  if (link.view === "CUSTOMER") {
    const proposal = buildCustomerProposal(doc, link.project.name, catalog);
    return (
      <CustomerProposalView
        proposal={proposal}
        projectName={link.project.name}
        designDocument={doc}
        designImageUrl={designImageUrl}
      />
    );
  }

  const schematic = buildInstallerSchematic(doc, catalog, pricing, (zoneId) => {
    const zone = doc.zones.find((z) => z.id === zoneId);
    if (!zone) return { totalGpm: 0, criticalHeadPressurePsi: 0 };
    const hyd = calculateZoneHydraulics(
      zone,
      doc.heads,
      doc.pipes,
      doc.waterSource,
      catalog,
      doc.scale
    );
    return { totalGpm: hyd.totalGpm, criticalHeadPressurePsi: hyd.criticalHeadPressurePsi };
  });

  return (
    <InstallerSchematicView
      schematic={schematic}
      projectName={link.project.name}
      designDocument={doc}
      designImageUrl={designImageUrl}
    />
  );
}

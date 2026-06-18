import { notFound } from "next/navigation";
import {
  getActiveDesignVersion,
  getDesignVersions,
  getProject,
} from "@/lib/actions/design";
import { getCatalogItems } from "@/lib/catalog";
import { getPricingProfile } from "@/lib/actions/design";
import { getTourStatus } from "@/lib/actions/tour";
import { getPlacementMlStatus } from "@/lib/actions/placement-ml";
import { auth } from "@/lib/auth";
import { blobProxyUrl } from "@/lib/blob/urls";
import { DesignWorkspace } from "@/components/design/DesignWorkspace";
import type { DesignDocument, PricingProfileData } from "@/lib/domain/types";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function DesignPage({ params }: Props) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const [project, version, versions, catalog, pricing, tourStatus, mlStatus] = await Promise.all([
    getProject(projectId),
    getActiveDesignVersion(projectId),
    getDesignVersions(projectId),
    getCatalogItems(session.user.organizationId),
    getPricingProfile(),
    getTourStatus(),
    getPlacementMlStatus(),
  ]);

  const pricingData: PricingProfileData = pricing
    ? {
        pipePerFoot: pricing.pipePerFoot,
        headCost: pricing.headCost,
        valveCost: pricing.valveCost,
        laborMultiplier: pricing.laborMultiplier,
        markup: pricing.markup,
        tax: pricing.tax,
        wasteFactor: pricing.wasteFactor,
        fittingAssumptions: (pricing.fittingAssumptions as Record<string, number>) ?? {},
      }
    : {
        pipePerFoot: 1.25,
        headCost: 8.5,
        valveCost: 45,
        laborMultiplier: 1.5,
        markup: 0.25,
        tax: 0.08,
        wasteFactor: 0.1,
        fittingAssumptions: { elbow: 2.5 },
      };

  const designData = version.designData as DesignDocument;
  const imageUrl = designData.propertyImage?.blobPath
    ? blobProxyUrl(designData.propertyImage.blobPath)
    : undefined;

  return (
    <DesignWorkspace
      project={project}
      version={version}
      versions={versions}
      catalog={catalog}
      pricing={pricingData}
      imageUrl={imageUrl}
      tourStatus={{
        completedAt: tourStatus.completedAt,
        autoShow: tourStatus.autoShow,
      }}
      mlStatus={mlStatus}
    />
  );
}

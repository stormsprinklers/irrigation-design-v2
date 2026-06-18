import { auth } from "@/lib/auth";
import { getCatalogItems } from "@/lib/catalog";
import { getTrainingTourStatus } from "@/lib/actions/tour";
import { getTrainingExampleStats } from "@/lib/actions/training";
import { getPlacementMlStatus } from "@/lib/actions/placement-ml";
import { redirect } from "next/navigation";
import { TrainingWorkspace } from "@/components/training/TrainingWorkspace";

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [catalog, tourStatus, stats, mlStatus] = await Promise.all([
    getCatalogItems(session.user.organizationId),
    getTrainingTourStatus(),
    getTrainingExampleStats(),
    getPlacementMlStatus(),
  ]);

  return (
    <TrainingWorkspace catalog={catalog} tourStatus={tourStatus} stats={stats} mlStatus={mlStatus} />
  );
}

import { auth } from "@/lib/auth";
import { getCatalogItems } from "@/lib/catalog";
import { getTrainingTourStatus } from "@/lib/actions/tour";
import { redirect } from "next/navigation";
import { TrainingWorkspace } from "@/components/training/TrainingWorkspace";

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [catalog, tourStatus] = await Promise.all([
    getCatalogItems(session.user.organizationId),
    getTrainingTourStatus(),
  ]);

  return <TrainingWorkspace catalog={catalog} tourStatus={tourStatus} />;
}

import { auth } from "@/lib/auth";
import { getCatalogItems } from "@/lib/catalog";
import { redirect } from "next/navigation";
import { TrainingWorkspace } from "@/components/training/TrainingWorkspace";

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const catalog = await getCatalogItems(session.user.organizationId);

  return <TrainingWorkspace catalog={catalog} />;
}

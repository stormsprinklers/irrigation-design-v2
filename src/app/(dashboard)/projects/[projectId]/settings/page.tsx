import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProject } from "@/lib/actions/design";
import { ProjectCrmLinkForm } from "@/components/projects/ProjectCrmLinkForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectSettingsPage({ params }: Props) {
  const { projectId } = await params;
  const project = await getProject(projectId).catch(() => null);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
          <Link href={`/projects/${projectId}/design`}>
            <ArrowLeft className="h-4 w-4" />
            Back to design
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-muted-foreground">Project settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CRM link</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectCrmLinkForm
            projectId={project.id}
            initial={{
              crmCustomerId: project.crmCustomerId,
              crmPropertyId: project.crmPropertyId,
              customerName: project.customerName,
              address: project.address,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

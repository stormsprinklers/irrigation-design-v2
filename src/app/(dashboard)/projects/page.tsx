import Link from "next/link";
import { listProjects } from "@/lib/actions/design";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-muted-foreground">Irrigation designs for your customers</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">New project</Link>
        </Button>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.length === 0 ? (
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>No projects yet</CardTitle>
              <CardDescription>Create your first irrigation design project</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}/design`}>
              <Card className="transition hover:border-primary/50">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>
                    {project.customerName || "No customer"} · {project.status}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {project._count.versions} version(s)
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

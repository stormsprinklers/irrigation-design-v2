"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProject } from "@/lib/actions/design";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateProjectForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const project = await createProject({
      name: String(form.get("name")),
      customerName: String(form.get("customerName") || "") || undefined,
      address: String(form.get("address") || "") || undefined,
    });
    router.push(`/projects/${project.id}/design`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" required placeholder="Smith residence" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="customerName">Customer name</Label>
        <Input id="customerName" name="customerName" placeholder="John Smith" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" placeholder="123 Main St" />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create & open design"}
      </Button>
    </form>
  );
}

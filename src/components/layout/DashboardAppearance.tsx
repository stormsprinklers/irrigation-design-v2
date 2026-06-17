"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function DashboardAppearance() {
  return (
    <div className="border-t p-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Appearance</p>
      <ThemeToggle />
    </div>
  );
}

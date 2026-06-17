"use client";

import { useDesignStore } from "@/lib/stores/design-store";
import { cn } from "@/lib/utils";

export function ValidationDrawer() {
  const { validationIssues } = useDesignStore();

  const critical = validationIssues.filter((i) => i.severity === "critical").length;
  const warnings = validationIssues.filter((i) => i.severity === "warning").length;

  if (validationIssues.length === 0) {
    return (
      <div
        data-tour="tour-validation-drawer"
        className="border-t bg-card/50 px-4 py-2 min-h-[2.5rem]"
        aria-hidden
      />
    );
  }

  return (
    <div className="border-t bg-card px-4 py-3" data-tour="tour-validation-drawer">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Validation report
          <span className="ml-2 text-muted-foreground">
            {critical > 0 && <span className="text-destructive">{critical} critical</span>}
            {warnings > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">{warnings} warnings</span>
            )}
          </span>
        </h3>
      </div>
      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
        {validationIssues.map((issue, i) => (
          <li
            key={`${issue.code}-${i}`}
            className={cn(
              "rounded px-2 py-1 text-xs",
              issue.severity === "critical" && "bg-destructive/10 text-destructive",
              issue.severity === "warning" &&
                "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
              issue.severity === "info" && "bg-muted text-muted-foreground"
            )}
          >
            <span className="font-medium">{issue.code}</span>: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

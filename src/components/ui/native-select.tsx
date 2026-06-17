import * as React from "react";
import { cn } from "@/lib/utils";

export const nativeSelectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(nativeSelectClassName, className)} {...props} />
));
NativeSelect.displayName = "NativeSelect";

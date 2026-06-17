"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      richColors
      position="top-right"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}

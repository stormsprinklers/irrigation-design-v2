"use client";

import { useTheme } from "next-themes";

export const CANVAS_SURFACE = {
  light: { fill: "#f8fafc", stroke: "#e2e8f0" },
  dark: { fill: "#1e293b", stroke: "#475569" },
} as const;

export function useCanvasSurface() {
  const { resolvedTheme } = useTheme();
  return CANVAS_SURFACE[resolvedTheme === "dark" ? "dark" : "light"];
}

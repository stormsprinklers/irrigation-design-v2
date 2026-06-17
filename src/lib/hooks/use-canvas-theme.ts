"use client";

import { useTheme } from "next-themes";

export const CANVAS_SURFACE = {
  light: { fill: "#f8fafc", stroke: "#e2e8f0" },
  dark: { fill: "#1e293b", stroke: "#475569" },
} as const;

/** Visible wedge / strip footprint outline on the canvas. */
export const COVERAGE_OUTLINE = {
  light: { stroke: "rgba(29, 78, 216, 0.7)", width: 1.5 },
  dark: { stroke: "rgba(147, 197, 253, 0.9)", width: 2 },
} as const;

export function useCanvasSurface() {
  const { resolvedTheme } = useTheme();
  return CANVAS_SURFACE[resolvedTheme === "dark" ? "dark" : "light"];
}

export function useCoverageOutline() {
  const { resolvedTheme } = useTheme();
  return COVERAGE_OUTLINE[resolvedTheme === "dark" ? "dark" : "light"];
}

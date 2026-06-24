import type { Point } from "./types";

export function polygonAreaSqPixels(vertices: Point[]): number {
  if (vertices.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

export function polygonAreaSqFt(vertices: Point[], pixelsPerFoot: number | null): number {
  if (!pixelsPerFoot || pixelsPerFoot <= 0) return 0;
  const sqPixels = polygonAreaSqPixels(vertices);
  return sqPixels / (pixelsPerFoot * pixelsPerFoot);
}

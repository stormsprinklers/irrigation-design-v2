import { pointInPolygon, polygonBounds } from "../placement/geometry";
import type { Point } from "../types";
import type { PrecipGrid } from "../training/types";

export function samplePointsInPolygonFeet(
  vertices: Point[],
  stepFt = 1.5
): Point[] {
  const bounds = polygonBounds(vertices);
  const points: Point[] = [];
  for (let y = bounds.minY; y <= bounds.maxY; y += stepFt) {
    for (let x = bounds.minX; x <= bounds.maxX; x += stepFt) {
      const p = { x, y };
      if (pointInPolygon(p, vertices)) points.push(p);
    }
  }
  return points;
}

export function buildPrecipGrid(
  vertices: Point[],
  samplePoints: Point[],
  values: number[],
  stepFt: number
): PrecipGrid {
  const bounds = polygonBounds(vertices);
  const cols = Math.max(1, Math.floor((bounds.maxX - bounds.minX) / stepFt) + 1);
  const rows = Math.max(1, Math.floor((bounds.maxY - bounds.minY) / stepFt) + 1);
  const grid: PrecipGrid = {
    originFt: { x: bounds.minX, y: bounds.minY },
    stepFt,
    cols,
    rows,
    values: new Array(cols * rows).fill(0),
  };

  for (let i = 0; i < samplePoints.length; i++) {
    const idx = gridIndexForPoint(grid, samplePoints[i]!);
    if (idx >= 0) {
      grid.values[idx] = values[i] ?? 0;
    }
  }

  return grid;
}

export function gridIndexForPoint(grid: PrecipGrid, point: Point): number {
  const col = Math.round((point.x - grid.originFt.x) / grid.stepFt);
  const row = Math.round((point.y - grid.originFt.y) / grid.stepFt);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return -1;
  return row * grid.cols + col;
}

export function precipValueAtPoint(grid: PrecipGrid, point: Point): number {
  const idx = gridIndexForPoint(grid, point);
  if (idx < 0 || idx >= grid.values.length) return 0;
  return grid.values[idx] ?? 0;
}

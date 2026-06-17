import type { PrecipGrid } from "../training/types";

export type HeatmapColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export function precipToColor(value: number, min: number, max: number): HeatmapColor {
  if (max <= min || value <= 0) {
    return { r: 250, g: 204, b: 21, a: 0.35 };
  }
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (t < 0.35) {
    return { r: 250, g: 204, b: 21, a: 0.4 };
  }
  if (t < 0.75) {
    return { r: 34, g: 197, b: 94, a: 0.4 };
  }
  return { r: 59, g: 130, b: 246, a: 0.45 };
}

export function gridColorCells(
  grid: PrecipGrid,
  pxPerFt: number
): { x: number; y: number; width: number; height: number; color: HeatmapColor }[] {
  const values = grid.values.filter((v) => v > 0);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const cells: { x: number; y: number; width: number; height: number; color: HeatmapColor }[] = [];
  const cellPx = grid.stepFt * pxPerFt;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const idx = row * grid.cols + col;
      const value = grid.values[idx] ?? 0;
      if (value <= 0) continue;
      cells.push({
        x: (grid.originFt.x + col * grid.stepFt) * pxPerFt,
        y: (grid.originFt.y + row * grid.stepFt) * pxPerFt,
        width: cellPx,
        height: cellPx,
        color: precipToColor(value, min, max),
      });
    }
  }
  return cells;
}

export function normalizeGridValues(grid: PrecipGrid): number[] {
  const max = Math.max(...grid.values, 1e-9);
  return grid.values.map((v) => v / max);
}

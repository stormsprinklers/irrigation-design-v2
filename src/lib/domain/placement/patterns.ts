import type { SpacingPattern } from "../types";

export type GridPoint = {
  x: number;
  y: number;
  row: number;
  col: number;
};

export function generateSquareGrid(
  origin: { x: number; y: number },
  spacingPx: number,
  cols: number,
  rows: number,
  orientationDeg = 0
): GridPoint[] {
  const points: GridPoint[] = [];
  const rad = (orientationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lx = col * spacingPx;
      const ly = row * spacingPx;
      points.push({
        x: origin.x + lx * cos - ly * sin,
        y: origin.y + lx * sin + ly * cos,
        row,
        col,
      });
    }
  }
  return points;
}

export function generateTriangularGrid(
  origin: { x: number; y: number },
  spacingPx: number,
  cols: number,
  rows: number,
  orientationDeg = 0
): GridPoint[] {
  const rowHeight = spacingPx * 0.8660254;
  const rad = (orientationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const points: GridPoint[] = [];

  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 1 ? spacingPx / 2 : 0;
    for (let col = 0; col < cols; col++) {
      const lx = col * spacingPx + offset;
      const ly = row * rowHeight;
      points.push({
        x: origin.x + lx * cos - ly * sin,
        y: origin.y + lx * sin + ly * cos,
        row,
        col,
      });
    }
  }
  return points;
}

export function gridDimensionsForBounds(
  widthPx: number,
  heightPx: number,
  spacingPx: number,
  pattern: SpacingPattern
): { cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(widthPx / spacingPx) + 1);
  const rowSpacing = pattern === "triangular" ? spacingPx * 0.8660254 : spacingPx;
  const rows = Math.max(1, Math.ceil(heightPx / rowSpacing) + 1);
  return { cols, rows };
}

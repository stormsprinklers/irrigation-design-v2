import type { CatalogItemData, Point } from "../types";

export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function pixelsPerFoot(
  scale: { pointA: Point; pointB: Point; realWorldFeet: number } | undefined
): number | null {
  if (!scale || scale.realWorldFeet <= 0) return null;
  const pixelDist = distance(scale.pointA, scale.pointB);
  if (pixelDist <= 0) return null;
  return pixelDist / scale.realWorldFeet;
}

export function feetToPixels(feet: number, pixelsPerFootValue: number): number {
  return feet * pixelsPerFootValue;
}

export function pixelsToFeet(pixels: number, pixelsPerFootValue: number): number {
  return pixels / pixelsPerFootValue;
}

export function polylineLengthFeet(points: Point[], ppf: number): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1], points[i]);
  }
  return pixelsToFeet(total, ppf);
}

export function interpolateGpm(
  nozzle: CatalogItemData,
  pressurePsi: number
): { gpm: number; radiusFeet?: number; precipInPerHr?: number } {
  const chart = nozzle.nozzleChart;
  if (!chart || chart.pressurePsi.length === 0) {
    return { gpm: 1.5, radiusFeet: 12, precipInPerHr: 1.5 };
  }

  const pressures = chart.pressurePsi;
  const idx = pressures.findIndex((p) => p >= pressurePsi);
  if (idx <= 0) {
    return {
      gpm: chart.gpm[0],
      radiusFeet: chart.radiusFeet?.[0],
      precipInPerHr: chart.precipInPerHr?.[0],
    };
  }
  if (idx === -1) {
    const last = pressures.length - 1;
    return {
      gpm: chart.gpm[last],
      radiusFeet: chart.radiusFeet?.[last],
      precipInPerHr: chart.precipInPerHr?.[last],
    };
  }

  const p0 = pressures[idx - 1];
  const p1 = pressures[idx];
  const t = (pressurePsi - p0) / (p1 - p0);
  const lerp = (a: number, b: number) => a + (b - a) * t;

  return {
    gpm: lerp(chart.gpm[idx - 1], chart.gpm[idx]),
    radiusFeet:
      chart.radiusFeet && chart.radiusFeet[idx - 1] !== undefined
        ? lerp(chart.radiusFeet[idx - 1], chart.radiusFeet[idx]!)
        : undefined,
    precipInPerHr:
      chart.precipInPerHr && chart.precipInPerHr[idx - 1] !== undefined
        ? lerp(chart.precipInPerHr[idx - 1], chart.precipInPerHr[idx]!)
        : undefined,
  };
}

/** Hazen-Williams friction loss in PSI for imperial units */
export function calculateFrictionLoss(
  flowGpm: number,
  diameterInches: number,
  lengthFeet: number,
  cCoefficient = 150
): number {
  if (flowGpm <= 0 || diameterInches <= 0 || lengthFeet <= 0) return 0;
  const loss =
    (4.52 * lengthFeet * Math.pow(flowGpm / cCoefficient, 1.85)) /
    Math.pow(diameterInches, 4.87);
  return Math.round(loss * 100) / 100;
}

export function calculatePipeVelocity(flowGpm: number, diameterInches: number): number {
  if (diameterInches <= 0) return 0;
  const areaSqFt = Math.PI * Math.pow(diameterInches / 12 / 2, 2);
  const flowCfs = flowGpm / 448.831;
  return flowCfs / areaSqFt;
}

export function calculateHeadGpm(
  nozzle: CatalogItemData,
  pressurePsi: number
): { gpm: number; radiusFeet?: number; precipInPerHr?: number } {
  return interpolateGpm(nozzle, pressurePsi);
}

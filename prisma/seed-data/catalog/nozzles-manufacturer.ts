/**
 * Rain Bird & Hunter nozzle performance data transcribed from manufacturer charts.
 * Sources: chart_3500.pdf, chart_5000.pdf, R-VAN-TechSpec-27AUG18.pdf, rc_mprotator_dom.pdf
 */
import { buildNozzleChart, type CatalogSeedItem, type ChartPoint } from "./chart";

const RB_1800_HEADS = ["rainbird_1800", "rainbird_1800_prs", "rainbird_1800_sam"];

function rotorNozzle(
  id: string,
  model: string,
  nozzleFamily: string,
  headFamilies: string[],
  specs: Record<string, unknown>,
  points: ChartPoint[],
  recommendedPsi?: number
): CatalogSeedItem {
  return {
    id,
    category: "ROTOR",
    manufacturer: "Rain Bird",
    model,
    specs: {
      itemRole: "nozzle",
      nozzleFamily,
      compatibleHeadFamilies: headFamilies,
      ...specs,
    },
    nozzleChart: buildNozzleChart(points, recommendedPsi),
  };
}

function mpNozzle(
  id: string,
  model: string,
  specs: Record<string, unknown>,
  points: ChartPoint[],
  recommendedPsi = 40
): CatalogSeedItem {
  return {
    id,
    category: "MP_ROTATOR",
    manufacturer: "Hunter",
    model,
    specs: {
      itemRole: "nozzle",
      nozzleFamily: "hunter_mp_rotator",
      compatibleHeadFamilies: ["hunter_pro_spray", "hunter_pro_spray_prs40"],
      ...specs,
    },
    nozzleChart: buildNozzleChart(points, recommendedPsi),
  };
}

function sprayNozzle(
  id: string,
  model: string,
  nozzleFamily: string,
  headFamilies: string[],
  specs: Record<string, unknown>,
  points: ChartPoint[],
  recommendedPsi = 45
): CatalogSeedItem {
  return {
    id,
    category: "MP_ROTATOR",
    manufacturer: "Rain Bird",
    model,
    specs: {
      itemRole: "nozzle",
      nozzleFamily,
      compatibleHeadFamilies: headFamilies,
      ...specs,
    },
    nozzleChart: buildNozzleChart(points, recommendedPsi),
  };
}

// --- Rain Bird 3500 Series (imperial, half-circle precip) ---
const RB3500_DATA: Record<string, ChartPoint[]> = {
  "0.75": [
    { pressurePsi: 25, radiusFeet: 15, gpm: 0.54, precipSqInPerHr: 0.46, precipTriInPerHr: 0.53 },
    { pressurePsi: 35, radiusFeet: 17, gpm: 0.67, precipSqInPerHr: 0.45, precipTriInPerHr: 0.52 },
    { pressurePsi: 45, radiusFeet: 17, gpm: 0.77, precipSqInPerHr: 0.51, precipTriInPerHr: 0.59 },
    { pressurePsi: 55, radiusFeet: 18, gpm: 0.85, precipSqInPerHr: 0.51, precipTriInPerHr: 0.58 },
  ],
  "1.0": [
    { pressurePsi: 25, radiusFeet: 20, gpm: 0.77, precipSqInPerHr: 0.37, precipTriInPerHr: 0.43 },
    { pressurePsi: 35, radiusFeet: 21, gpm: 0.92, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    { pressurePsi: 45, radiusFeet: 21, gpm: 1.06, precipSqInPerHr: 0.46, precipTriInPerHr: 0.53 },
    { pressurePsi: 55, radiusFeet: 22, gpm: 1.18, precipSqInPerHr: 0.47, precipTriInPerHr: 0.54 },
  ],
  "1.5": [
    { pressurePsi: 25, radiusFeet: 23, gpm: 1.06, precipSqInPerHr: 0.39, precipTriInPerHr: 0.45 },
    { pressurePsi: 35, radiusFeet: 23, gpm: 1.28, precipSqInPerHr: 0.47, precipTriInPerHr: 0.54 },
    { pressurePsi: 45, radiusFeet: 24, gpm: 1.48, precipSqInPerHr: 0.49, precipTriInPerHr: 0.57 },
    { pressurePsi: 55, radiusFeet: 24, gpm: 1.65, precipSqInPerHr: 0.55, precipTriInPerHr: 0.64 },
  ],
  "2.0": [
    { pressurePsi: 25, radiusFeet: 27, gpm: 1.4, precipSqInPerHr: 0.37, precipTriInPerHr: 0.43 },
    { pressurePsi: 35, radiusFeet: 27, gpm: 1.69, precipSqInPerHr: 0.45, precipTriInPerHr: 0.52 },
    { pressurePsi: 45, radiusFeet: 27, gpm: 1.93, precipSqInPerHr: 0.51, precipTriInPerHr: 0.59 },
    { pressurePsi: 55, radiusFeet: 28, gpm: 2.15, precipSqInPerHr: 0.53, precipTriInPerHr: 0.61 },
  ],
  "3.0": [
    { pressurePsi: 25, radiusFeet: 29, gpm: 2.17, precipSqInPerHr: 0.5, precipTriInPerHr: 0.57 },
    { pressurePsi: 35, radiusFeet: 31, gpm: 2.6, precipSqInPerHr: 0.52, precipTriInPerHr: 0.6 },
    { pressurePsi: 45, radiusFeet: 31, gpm: 3.0, precipSqInPerHr: 0.6, precipTriInPerHr: 0.69 },
    { pressurePsi: 55, radiusFeet: 32, gpm: 3.25, precipSqInPerHr: 0.61, precipTriInPerHr: 0.71 },
  ],
  "4.0": [
    { pressurePsi: 25, radiusFeet: 31, gpm: 2.97, precipSqInPerHr: 0.59, precipTriInPerHr: 0.69 },
    { pressurePsi: 35, radiusFeet: 33, gpm: 3.58, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
    { pressurePsi: 45, radiusFeet: 35, gpm: 4.13, precipSqInPerHr: 0.65, precipTriInPerHr: 0.75 },
    { pressurePsi: 55, radiusFeet: 35, gpm: 4.6, precipSqInPerHr: 0.72, precipTriInPerHr: 0.83 },
  ],
};

// --- Rain Bird 5000 Standard Rain Curtain ---
const RB5000_STD: Record<string, ChartPoint[]> = {
  "1.5": [
    { pressurePsi: 25, radiusFeet: 33, gpm: 1.12, precipSqInPerHr: 0.2, precipTriInPerHr: 0.23 },
    { pressurePsi: 35, radiusFeet: 34, gpm: 1.35, precipSqInPerHr: 0.22, precipTriInPerHr: 0.26 },
    { pressurePsi: 45, radiusFeet: 35, gpm: 1.54, precipSqInPerHr: 0.24, precipTriInPerHr: 0.28 },
    { pressurePsi: 55, radiusFeet: 35, gpm: 1.71, precipSqInPerHr: 0.27, precipTriInPerHr: 0.31 },
    { pressurePsi: 65, radiusFeet: 34, gpm: 1.86, precipSqInPerHr: 0.31, precipTriInPerHr: 0.36 },
  ],
  "2.0": [
    { pressurePsi: 25, radiusFeet: 35, gpm: 1.5, precipSqInPerHr: 0.24, precipTriInPerHr: 0.27 },
    { pressurePsi: 35, radiusFeet: 36, gpm: 1.81, precipSqInPerHr: 0.27, precipTriInPerHr: 0.31 },
    { pressurePsi: 45, radiusFeet: 37, gpm: 2.07, precipSqInPerHr: 0.29, precipTriInPerHr: 0.34 },
    { pressurePsi: 55, radiusFeet: 37, gpm: 2.3, precipSqInPerHr: 0.32, precipTriInPerHr: 0.37 },
    { pressurePsi: 65, radiusFeet: 35, gpm: 2.52, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
  ],
  "2.5": [
    { pressurePsi: 25, radiusFeet: 35, gpm: 1.81, precipSqInPerHr: 0.28, precipTriInPerHr: 0.33 },
    { pressurePsi: 35, radiusFeet: 37, gpm: 2.17, precipSqInPerHr: 0.31, precipTriInPerHr: 0.35 },
    { pressurePsi: 45, radiusFeet: 37, gpm: 2.51, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
    { pressurePsi: 55, radiusFeet: 37, gpm: 2.76, precipSqInPerHr: 0.39, precipTriInPerHr: 0.45 },
    { pressurePsi: 65, radiusFeet: 37, gpm: 3.01, precipSqInPerHr: 0.42, precipTriInPerHr: 0.49 },
  ],
  "3.0": [
    { pressurePsi: 25, radiusFeet: 36, gpm: 2.26, precipSqInPerHr: 0.34, precipTriInPerHr: 0.39 },
    { pressurePsi: 35, radiusFeet: 38, gpm: 2.71, precipSqInPerHr: 0.36, precipTriInPerHr: 0.42 },
    { pressurePsi: 45, radiusFeet: 40, gpm: 3.09, precipSqInPerHr: 0.37, precipTriInPerHr: 0.43 },
    { pressurePsi: 55, radiusFeet: 40, gpm: 3.47, precipSqInPerHr: 0.42, precipTriInPerHr: 0.48 },
    { pressurePsi: 65, radiusFeet: 40, gpm: 3.78, precipSqInPerHr: 0.45, precipTriInPerHr: 0.53 },
  ],
  "4.0": [
    { pressurePsi: 25, radiusFeet: 37, gpm: 2.91, precipSqInPerHr: 0.41, precipTriInPerHr: 0.47 },
    { pressurePsi: 35, radiusFeet: 40, gpm: 3.5, precipSqInPerHr: 0.42, precipTriInPerHr: 0.49 },
    { pressurePsi: 45, radiusFeet: 42, gpm: 4.01, precipSqInPerHr: 0.44, precipTriInPerHr: 0.51 },
    { pressurePsi: 55, radiusFeet: 42, gpm: 4.44, precipSqInPerHr: 0.48, precipTriInPerHr: 0.56 },
    { pressurePsi: 65, radiusFeet: 42, gpm: 4.83, precipSqInPerHr: 0.53, precipTriInPerHr: 0.61 },
  ],
  "5.0": [
    { pressurePsi: 25, radiusFeet: 39, gpm: 3.72, precipSqInPerHr: 0.47, precipTriInPerHr: 0.54 },
    { pressurePsi: 35, radiusFeet: 41, gpm: 4.47, precipSqInPerHr: 0.51, precipTriInPerHr: 0.59 },
    { pressurePsi: 45, radiusFeet: 45, gpm: 5.09, precipSqInPerHr: 0.48, precipTriInPerHr: 0.56 },
    { pressurePsi: 55, radiusFeet: 45, gpm: 5.66, precipSqInPerHr: 0.54, precipTriInPerHr: 0.62 },
    { pressurePsi: 65, radiusFeet: 45, gpm: 6.16, precipSqInPerHr: 0.59, precipTriInPerHr: 0.68 },
  ],
  "6.0": [
    { pressurePsi: 25, radiusFeet: 39, gpm: 4.25, precipSqInPerHr: 0.54, precipTriInPerHr: 0.62 },
    { pressurePsi: 35, radiusFeet: 43, gpm: 5.23, precipSqInPerHr: 0.54, precipTriInPerHr: 0.63 },
    { pressurePsi: 45, radiusFeet: 46, gpm: 6.01, precipSqInPerHr: 0.55, precipTriInPerHr: 0.63 },
    { pressurePsi: 55, radiusFeet: 47, gpm: 6.63, precipSqInPerHr: 0.58, precipTriInPerHr: 0.67 },
    { pressurePsi: 65, radiusFeet: 48, gpm: 7.22, precipSqInPerHr: 0.6, precipTriInPerHr: 0.7 },
  ],
  "8.0": [
    { pressurePsi: 25, radiusFeet: 36, gpm: 5.9, precipSqInPerHr: 0.88, precipTriInPerHr: 1.01 },
    { pressurePsi: 35, radiusFeet: 43, gpm: 7.06, precipSqInPerHr: 0.74, precipTriInPerHr: 0.85 },
    { pressurePsi: 45, radiusFeet: 47, gpm: 8.03, precipSqInPerHr: 0.7, precipTriInPerHr: 0.81 },
    { pressurePsi: 55, radiusFeet: 50, gpm: 8.86, precipSqInPerHr: 0.68, precipTriInPerHr: 0.79 },
    { pressurePsi: 65, radiusFeet: 50, gpm: 9.63, precipSqInPerHr: 0.74, precipTriInPerHr: 0.86 },
  ],
};

const RB5000_LA: Record<string, ChartPoint[]> = {
  "1.0": [
    { pressurePsi: 25, radiusFeet: 25, gpm: 0.76, precipSqInPerHr: 0.23, precipTriInPerHr: 0.27 },
    { pressurePsi: 35, radiusFeet: 28, gpm: 0.92, precipSqInPerHr: 0.23, precipTriInPerHr: 0.26 },
    { pressurePsi: 45, radiusFeet: 29, gpm: 1.05, precipSqInPerHr: 0.24, precipTriInPerHr: 0.28 },
    { pressurePsi: 55, radiusFeet: 29, gpm: 1.17, precipSqInPerHr: 0.27, precipTriInPerHr: 0.31 },
    { pressurePsi: 65, radiusFeet: 29, gpm: 1.27, precipSqInPerHr: 0.29, precipTriInPerHr: 0.34 },
  ],
  "1.5": [
    { pressurePsi: 25, radiusFeet: 27, gpm: 1.15, precipSqInPerHr: 0.3, precipTriInPerHr: 0.35 },
    { pressurePsi: 35, radiusFeet: 30, gpm: 1.38, precipSqInPerHr: 0.3, precipTriInPerHr: 0.34 },
    { pressurePsi: 45, radiusFeet: 31, gpm: 1.58, precipSqInPerHr: 0.32, precipTriInPerHr: 0.37 },
    { pressurePsi: 55, radiusFeet: 31, gpm: 1.76, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
    { pressurePsi: 65, radiusFeet: 31, gpm: 1.92, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
  ],
  "2.0": [
    { pressurePsi: 25, radiusFeet: 29, gpm: 1.47, precipSqInPerHr: 0.34, precipTriInPerHr: 0.39 },
    { pressurePsi: 35, radiusFeet: 31, gpm: 1.77, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
    { pressurePsi: 45, radiusFeet: 32, gpm: 2.02, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
    { pressurePsi: 55, radiusFeet: 33, gpm: 2.24, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    { pressurePsi: 65, radiusFeet: 33, gpm: 2.45, precipSqInPerHr: 0.43, precipTriInPerHr: 0.5 },
  ],
  "3.0": [
    { pressurePsi: 25, radiusFeet: 29, gpm: 2.23, precipSqInPerHr: 0.51, precipTriInPerHr: 0.59 },
    { pressurePsi: 35, radiusFeet: 33, gpm: 2.68, precipSqInPerHr: 0.47, precipTriInPerHr: 0.55 },
    { pressurePsi: 45, radiusFeet: 35, gpm: 3.07, precipSqInPerHr: 0.48, precipTriInPerHr: 0.56 },
    { pressurePsi: 55, radiusFeet: 36, gpm: 3.41, precipSqInPerHr: 0.51, precipTriInPerHr: 0.58 },
    { pressurePsi: 65, radiusFeet: 36, gpm: 3.72, precipSqInPerHr: 0.55, precipTriInPerHr: 0.64 },
  ],
};

// R-VAN adjustable arc nozzles — one catalog item per model + arc
type RvanArc = {
  model: string;
  arc: number;
  radiusRange: [number, number];
  points: ChartPoint[];
};

const RVAN_ARCS: RvanArc[] = [
  {
    model: "R-VAN14",
    arc: 270,
    radiusRange: [8, 14],
    points: [
      { pressurePsi: 30, radiusFeet: 13, gpm: 0.84, precipSqInPerHr: 0.64, precipTriInPerHr: 0.76 },
      { pressurePsi: 35, radiusFeet: 13, gpm: 0.87, precipSqInPerHr: 0.66, precipTriInPerHr: 0.74 },
      { pressurePsi: 40, radiusFeet: 14, gpm: 0.92, precipSqInPerHr: 0.6, precipTriInPerHr: 0.71 },
      { pressurePsi: 45, radiusFeet: 14, gpm: 0.94, precipSqInPerHr: 0.62, precipTriInPerHr: 0.7 },
      { pressurePsi: 50, radiusFeet: 15, gpm: 1.11, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 55, radiusFeet: 15, gpm: 1.17, precipSqInPerHr: 0.67, precipTriInPerHr: 0.77 },
    ],
  },
  {
    model: "R-VAN14",
    arc: 210,
    radiusRange: [8, 14],
    points: [
      { pressurePsi: 30, radiusFeet: 13, gpm: 0.65, precipSqInPerHr: 0.64, precipTriInPerHr: 0.76 },
      { pressurePsi: 35, radiusFeet: 13, gpm: 0.68, precipSqInPerHr: 0.66, precipTriInPerHr: 0.74 },
      { pressurePsi: 40, radiusFeet: 14, gpm: 0.72, precipSqInPerHr: 0.6, precipTriInPerHr: 0.71 },
      { pressurePsi: 45, radiusFeet: 14, gpm: 0.73, precipSqInPerHr: 0.62, precipTriInPerHr: 0.7 },
      { pressurePsi: 50, radiusFeet: 15, gpm: 0.86, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 55, radiusFeet: 15, gpm: 0.91, precipSqInPerHr: 0.67, precipTriInPerHr: 0.77 },
    ],
  },
  {
    model: "R-VAN14",
    arc: 180,
    radiusRange: [8, 14],
    points: [
      { pressurePsi: 30, radiusFeet: 13, gpm: 0.56, precipSqInPerHr: 0.64, precipTriInPerHr: 0.76 },
      { pressurePsi: 35, radiusFeet: 13, gpm: 0.58, precipSqInPerHr: 0.66, precipTriInPerHr: 0.74 },
      { pressurePsi: 40, radiusFeet: 14, gpm: 0.61, precipSqInPerHr: 0.6, precipTriInPerHr: 0.71 },
      { pressurePsi: 45, radiusFeet: 14, gpm: 0.63, precipSqInPerHr: 0.62, precipTriInPerHr: 0.7 },
      { pressurePsi: 50, radiusFeet: 15, gpm: 0.74, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 55, radiusFeet: 15, gpm: 0.78, precipSqInPerHr: 0.67, precipTriInPerHr: 0.77 },
    ],
  },
  {
    model: "R-VAN14",
    arc: 90,
    radiusRange: [8, 14],
    points: [
      { pressurePsi: 30, radiusFeet: 13, gpm: 0.28, precipSqInPerHr: 0.62, precipTriInPerHr: 0.71 },
      { pressurePsi: 35, radiusFeet: 13, gpm: 0.29, precipSqInPerHr: 0.61, precipTriInPerHr: 0.7 },
      { pressurePsi: 40, radiusFeet: 14, gpm: 0.31, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 45, radiusFeet: 14, gpm: 0.32, precipSqInPerHr: 0.67, precipTriInPerHr: 0.77 },
      { pressurePsi: 50, radiusFeet: 15, gpm: 0.37, precipSqInPerHr: 0.64, precipTriInPerHr: 0.76 },
      { pressurePsi: 55, radiusFeet: 15, gpm: 0.39, precipSqInPerHr: 0.66, precipTriInPerHr: 0.74 },
    ],
  },
  {
    model: "R-VAN14-360",
    arc: 360,
    radiusRange: [8, 14],
    points: [
      { pressurePsi: 30, radiusFeet: 13, gpm: 1.1, precipSqInPerHr: 0.63, precipTriInPerHr: 0.72 },
      { pressurePsi: 35, radiusFeet: 13, gpm: 1.12, precipSqInPerHr: 0.64, precipTriInPerHr: 0.74 },
      { pressurePsi: 40, radiusFeet: 14, gpm: 1.22, precipSqInPerHr: 0.6, precipTriInPerHr: 0.69 },
      { pressurePsi: 45, radiusFeet: 14, gpm: 1.27, precipSqInPerHr: 0.62, precipTriInPerHr: 0.72 },
      { pressurePsi: 50, radiusFeet: 15, gpm: 1.41, precipSqInPerHr: 0.6, precipTriInPerHr: 0.7 },
      { pressurePsi: 55, radiusFeet: 15, gpm: 1.45, precipSqInPerHr: 0.62, precipTriInPerHr: 0.72 },
    ],
  },
  {
    model: "R-VAN18",
    arc: 270,
    radiusRange: [13, 18],
    points: [
      { pressurePsi: 30, radiusFeet: 16, gpm: 1.26, precipSqInPerHr: 0.65, precipTriInPerHr: 0.75 },
      { pressurePsi: 35, radiusFeet: 16, gpm: 1.35, precipSqInPerHr: 0.64, precipTriInPerHr: 0.74 },
      { pressurePsi: 40, radiusFeet: 17, gpm: 1.42, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 45, radiusFeet: 17, gpm: 1.51, precipSqInPerHr: 0.64, precipTriInPerHr: 0.73 },
      { pressurePsi: 50, radiusFeet: 18, gpm: 1.57, precipSqInPerHr: 0.6, precipTriInPerHr: 0.69 },
      { pressurePsi: 55, radiusFeet: 18, gpm: 1.62, precipSqInPerHr: 0.6, precipTriInPerHr: 0.69 },
    ],
  },
  {
    model: "R-VAN18",
    arc: 180,
    radiusRange: [13, 18],
    points: [
      { pressurePsi: 30, radiusFeet: 16, gpm: 0.85, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 35, radiusFeet: 16, gpm: 0.91, precipSqInPerHr: 0.68, precipTriInPerHr: 0.78 },
      { pressurePsi: 40, radiusFeet: 17, gpm: 0.98, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 45, radiusFeet: 17, gpm: 1.01, precipSqInPerHr: 0.64, precipTriInPerHr: 0.73 },
      { pressurePsi: 50, radiusFeet: 18, gpm: 1.07, precipSqInPerHr: 0.65, precipTriInPerHr: 0.75 },
      { pressurePsi: 55, radiusFeet: 18, gpm: 1.09, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
    ],
  },
  {
    model: "R-VAN18-360",
    arc: 360,
    radiusRange: [13, 18],
    points: [
      { pressurePsi: 30, radiusFeet: 16, gpm: 1.65, precipSqInPerHr: 0.62, precipTriInPerHr: 0.72 },
      { pressurePsi: 35, radiusFeet: 16, gpm: 1.67, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 40, radiusFeet: 17, gpm: 1.8, precipSqInPerHr: 0.6, precipTriInPerHr: 0.69 },
      { pressurePsi: 45, radiusFeet: 17, gpm: 1.85, precipSqInPerHr: 0.62, precipTriInPerHr: 0.71 },
      { pressurePsi: 50, radiusFeet: 18, gpm: 2.05, precipSqInPerHr: 0.61, precipTriInPerHr: 0.7 },
      { pressurePsi: 55, radiusFeet: 18, gpm: 2.11, precipSqInPerHr: 0.63, precipTriInPerHr: 0.72 },
    ],
  },
  {
    model: "R-VAN24",
    arc: 270,
    radiusRange: [17, 24],
    points: [
      { pressurePsi: 30, radiusFeet: 19, gpm: 1.8, precipSqInPerHr: 0.64, precipTriInPerHr: 0.74 },
      { pressurePsi: 35, radiusFeet: 20, gpm: 1.95, precipSqInPerHr: 0.63, precipTriInPerHr: 0.72 },
      { pressurePsi: 40, radiusFeet: 22, gpm: 2.31, precipSqInPerHr: 0.61, precipTriInPerHr: 0.71 },
      { pressurePsi: 45, radiusFeet: 23, gpm: 2.52, precipSqInPerHr: 0.61, precipTriInPerHr: 0.71 },
      { pressurePsi: 50, radiusFeet: 24, gpm: 2.82, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 55, radiusFeet: 24, gpm: 2.88, precipSqInPerHr: 0.64, precipTriInPerHr: 0.74 },
    ],
  },
  {
    model: "R-VAN24",
    arc: 180,
    radiusRange: [17, 24],
    points: [
      { pressurePsi: 30, radiusFeet: 19, gpm: 1.2, precipSqInPerHr: 0.64, precipTriInPerHr: 0.74 },
      { pressurePsi: 35, radiusFeet: 20, gpm: 1.3, precipSqInPerHr: 0.63, precipTriInPerHr: 0.72 },
      { pressurePsi: 40, radiusFeet: 22, gpm: 1.54, precipSqInPerHr: 0.61, precipTriInPerHr: 0.71 },
      { pressurePsi: 45, radiusFeet: 23, gpm: 1.68, precipSqInPerHr: 0.61, precipTriInPerHr: 0.71 },
      { pressurePsi: 50, radiusFeet: 24, gpm: 1.88, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 55, radiusFeet: 24, gpm: 1.92, precipSqInPerHr: 0.64, precipTriInPerHr: 0.74 },
    ],
  },
  {
    model: "R-VAN24-360",
    arc: 360,
    radiusRange: [17, 24],
    points: [
      { pressurePsi: 30, radiusFeet: 19, gpm: 2.35, precipSqInPerHr: 0.63, precipTriInPerHr: 0.72 },
      { pressurePsi: 35, radiusFeet: 20, gpm: 2.52, precipSqInPerHr: 0.61, precipTriInPerHr: 0.7 },
      { pressurePsi: 40, radiusFeet: 22, gpm: 3.13, precipSqInPerHr: 0.62, precipTriInPerHr: 0.72 },
      { pressurePsi: 45, radiusFeet: 23, gpm: 3.48, precipSqInPerHr: 0.63, precipTriInPerHr: 0.73 },
      { pressurePsi: 50, radiusFeet: 24, gpm: 3.61, precipSqInPerHr: 0.6, precipTriInPerHr: 0.7 },
      { pressurePsi: 55, radiusFeet: 24, gpm: 3.74, precipSqInPerHr: 0.62, precipTriInPerHr: 0.72 },
    ],
  },
];

// Hunter MP Rotator — key models from rc_mprotator_dom chart (45 PSI recommended)
const MP_ROTATOR_MODELS: Array<{
  id: string;
  model: string;
  arc: number;
  radiusFeet: number;
  points: ChartPoint[];
}> = [
  {
    id: "noz_hunter_mp1000_90",
    model: "MP1000-90",
    arc: 90,
    radiusFeet: 12,
    points: [
      { pressurePsi: 30, radiusFeet: 10, gpm: 0.22, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 11, gpm: 0.25, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 12, gpm: 0.28, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp1000_210",
    model: "MP1000-210",
    arc: 210,
    radiusFeet: 12,
    points: [
      { pressurePsi: 30, radiusFeet: 10, gpm: 0.51, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 11, gpm: 0.58, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 12, gpm: 0.65, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp1000_360",
    model: "MP1000-360",
    arc: 360,
    radiusFeet: 12,
    points: [
      { pressurePsi: 30, radiusFeet: 10, gpm: 0.87, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 11, gpm: 0.99, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 12, gpm: 1.11, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp2000_90",
    model: "MP2000-90",
    arc: 90,
    radiusFeet: 16,
    points: [
      { pressurePsi: 30, radiusFeet: 14, gpm: 0.39, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 15, gpm: 0.45, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 16, gpm: 0.5, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp2000_210",
    model: "MP2000-210",
    arc: 210,
    radiusFeet: 16,
    points: [
      { pressurePsi: 30, radiusFeet: 14, gpm: 0.91, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 15, gpm: 1.04, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 16, gpm: 1.16, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp2000_360",
    model: "MP2000-360",
    arc: 360,
    radiusFeet: 16,
    points: [
      { pressurePsi: 30, radiusFeet: 14, gpm: 1.56, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 15, gpm: 1.78, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 16, gpm: 1.99, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp3000_90",
    model: "MP3000-90",
    arc: 90,
    radiusFeet: 20,
    points: [
      { pressurePsi: 30, radiusFeet: 18, gpm: 0.61, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 19, gpm: 0.7, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 20, gpm: 0.78, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp3000_210",
    model: "MP3000-210",
    arc: 210,
    radiusFeet: 20,
    points: [
      { pressurePsi: 30, radiusFeet: 18, gpm: 1.42, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 19, gpm: 1.63, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 20, gpm: 1.82, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp3000_360",
    model: "MP3000-360",
    arc: 360,
    radiusFeet: 20,
    points: [
      { pressurePsi: 30, radiusFeet: 18, gpm: 2.43, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 19, gpm: 2.79, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 20, gpm: 3.12, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp3500_90",
    model: "MP3500-90",
    arc: 90,
    radiusFeet: 24,
    points: [
      { pressurePsi: 30, radiusFeet: 22, gpm: 0.88, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 23, gpm: 1.01, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 24, gpm: 1.13, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp3500_210",
    model: "MP3500-210",
    arc: 210,
    radiusFeet: 24,
    points: [
      { pressurePsi: 30, radiusFeet: 22, gpm: 2.05, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 23, gpm: 2.35, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 24, gpm: 2.63, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
  {
    id: "noz_hunter_mp3500_360",
    model: "MP3500-360",
    arc: 360,
    radiusFeet: 24,
    points: [
      { pressurePsi: 30, radiusFeet: 22, gpm: 3.51, precipSqInPerHr: 0.35, precipTriInPerHr: 0.41 },
      { pressurePsi: 40, radiusFeet: 23, gpm: 4.03, precipSqInPerHr: 0.38, precipTriInPerHr: 0.44 },
      { pressurePsi: 50, radiusFeet: 24, gpm: 4.5, precipSqInPerHr: 0.4, precipTriInPerHr: 0.46 },
    ],
  },
];

export const MANUFACTURER_NOZZLES: CatalogSeedItem[] = [
  ...Object.entries(RB3500_DATA).map(([size, points]) =>
    rotorNozzle(
      `noz_rb_3500_${size.replace(".", "_")}`,
      `3500 Rain Curtain Nozzle ${size}`,
      "rainbird_3500",
      ["rainbird_3500"],
      { nozzleSize: Number(size), trajectoryDeg: 25 },
      points,
      45
    )
  ),
  ...Object.entries(RB5000_STD).map(([size, points]) =>
    rotorNozzle(
      `noz_rb_5000_${size.replace(".", "_")}`,
      `5000 Rain Curtain Nozzle ${size}`,
      "rainbird_5000_std",
      ["rainbird_5000"],
      { nozzleSize: Number(size), trajectoryDeg: 25, nozzleStyle: "standard" },
      points,
      45
    )
  ),
  ...Object.entries(RB5000_LA).map(([size, points]) =>
    rotorNozzle(
      `noz_rb_5000_la_${size.replace(".", "_")}`,
      `5000 Low Angle Nozzle ${size} LA`,
      "rainbird_5000_la",
      ["rainbird_5000"],
      { nozzleSize: Number(size), trajectoryDeg: 10, nozzleStyle: "low_angle" },
      points,
      45
    )
  ),
  ...RVAN_ARCS.map((r) =>
    sprayNozzle(
      `noz_rb_${r.model.toLowerCase().replace(/-/g, "_")}_arc${r.arc}`,
      `${r.model} ${r.arc}°`,
      "rainbird_rvan",
      RB_1800_HEADS,
      {
        arcDegrees: r.arc,
        radiusFeetMin: r.radiusRange[0],
        radiusFeetMax: r.radiusRange[1],
        adjustableArc: r.arc < 360,
      },
      r.points,
      45
    )
  ),
  ...MP_ROTATOR_MODELS.map((m) =>
    mpNozzle(
      m.id,
      m.model,
      { arcDegrees: m.arc, radiusFeet: m.radiusFeet },
      m.points,
      40
    )
  ),
];

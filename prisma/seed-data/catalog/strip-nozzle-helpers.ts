import { buildNozzleChart, type NozzleChart } from "./chart";

export type StripChartRow = [
  pressurePsi: number,
  widthFt: number,
  lengthFt: number,
  gpm: number,
  precipSq: number,
  precipTri: number,
];

/** Parse catalog W×L pattern strings (e.g. `5'x30'`, `5’ x 15’`). */
export function parsePatternSizeFt(patternSize: string): { widthFt: number; lengthFt: number } | null {
  const normalized = patternSize.replace(/[′']/g, "'");
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*'?\s*x\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return { widthFt: Number(match[1]), lengthFt: Number(match[2]) };
}

/** Nominal strip dimensions keyed by catalog model name. */
export const STRIP_MODEL_DIMENSIONS: Record<string, { widthFt: number; lengthFt: number }> = {
  "R-VAN-LCS": { widthFt: 5, lengthFt: 15 },
  "R-VAN-RCS": { widthFt: 5, lengthFt: 15 },
  "R-VAN-SST": { widthFt: 5, lengthFt: 30 },
  "MP-LCS-515": { widthFt: 5, lengthFt: 15 },
  "MP-RCS-515": { widthFt: 5, lengthFt: 15 },
  "MP-SS-530": { widthFt: 5, lengthFt: 30 },
  "15EST": { widthFt: 4, lengthFt: 15 },
  "15CST": { widthFt: 4, lengthFt: 30 },
  "15RCS": { widthFt: 4, lengthFt: 15 },
  "15LCS": { widthFt: 4, lengthFt: 15 },
  "15SST": { widthFt: 4, lengthFt: 30 },
  "9SST": { widthFt: 9, lengthFt: 18 },
};

/** TurfCatalog2019 R-VAN strip performance (W×L ft, length = throw). */
export const RVAN_STRIP_ROWS: Record<string, StripChartRow[]> = {
  "R-VAN-LCS": [
    [30, 4, 14, 0.18, 0.62, 0.62],
    [35, 5, 15, 0.22, 0.56, 0.56],
    [40, 5, 15, 0.23, 0.59, 0.59],
    [45, 5, 15, 0.24, 0.62, 0.62],
    [50, 5, 15, 0.25, 0.64, 0.64],
    [55, 6, 16, 0.28, 0.56, 0.56],
  ],
  "R-VAN-RCS": [
    [30, 4, 14, 0.18, 0.62, 0.62],
    [35, 5, 15, 0.22, 0.56, 0.56],
    [40, 5, 15, 0.23, 0.59, 0.59],
    [45, 5, 15, 0.24, 0.62, 0.62],
    [50, 5, 15, 0.25, 0.64, 0.64],
    [55, 6, 16, 0.28, 0.56, 0.56],
  ],
  "R-VAN-SST": [
    [30, 4, 28, 0.36, 0.62, 0.62],
    [35, 5, 30, 0.44, 0.56, 0.56],
    [40, 5, 30, 0.46, 0.59, 0.59],
    [45, 5, 30, 0.48, 0.62, 0.62],
    [50, 5, 30, 0.5, 0.64, 0.64],
    [55, 6, 32, 0.56, 0.56, 0.56],
  ],
};

export function buildStripNozzleChart(
  rows: StripChartRow[],
  recommendedPressurePsi = 45
): NozzleChart {
  return buildNozzleChart(
    rows.map(([pressurePsi, _w, lengthFt, gpm, precipSqInPerHr, precipTriInPerHr]) => ({
      pressurePsi,
      radiusFeet: lengthFt,
      gpm,
      precipSqInPerHr,
      precipTriInPerHr,
    })),
    recommendedPressurePsi
  );
}

export function stripLengthRange(rows: StripChartRow[]): { min: number; max: number } {
  const lengths = rows.map((r) => r[2]);
  return { min: Math.min(...lengths), max: Math.max(...lengths) };
}

/** Re-map a chart that incorrectly stored strip width in radiusFeet using W×L row data. */
export function remapStripChartFromRows(
  rows: StripChartRow[],
  recommendedPressurePsi = 45
): NozzleChart {
  return buildStripNozzleChart(rows, recommendedPressurePsi);
}

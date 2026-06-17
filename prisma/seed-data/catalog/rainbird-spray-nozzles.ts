/**
 * Rain Bird spray nozzles from TurfCatalog2019-SprayNozzles.pdf
 * (HE-VAN, U-Series, VAN, MPR, strip series, SQ — excludes bubblers)
 */
import { buildNozzleChart, type CatalogSeedItem, type ChartPoint } from "./chart";
import { sprayNozzleSpecs } from "./adjustability";

const RB_1800_HEADS = ["rainbird_1800", "rainbird_1800_prs", "rainbird_1800_sam"];

type ArcPattern = "Q" | "H" | "F";

const ARC_DEGREES: Record<ArcPattern, number> = {
  Q: 90,
  H: 180,
  F: 360,
};

function chartRows(
  rows: [pressurePsi: number, radiusFeet: number, gpm: number, precipSq: number, precipTri: number][]
): ChartPoint[] {
  return rows.map(([pressurePsi, radiusFeet, gpm, precipSqInPerHr, precipTriInPerHr]) => ({
    pressurePsi,
    radiusFeet,
    gpm,
    precipSqInPerHr,
    precipTriInPerHr,
  }));
}

function fixedArcSpray(
  id: string,
  model: string,
  family: string,
  pattern: ArcPattern,
  radiusMin: number,
  radiusMax: number,
  points: ChartPoint[],
  recommendedPsi = 30
): CatalogSeedItem {
  const arc = ARC_DEGREES[pattern];
  return {
    id,
    category: "SPRAY",
    manufacturer: "Rain Bird",
    model,
    specs: sprayNozzleSpecs(
      {
        nozzleFamily: family,
        compatibleHeadFamilies: RB_1800_HEADS,
        sprayPattern: pattern,
      },
      {
        arcMin: arc,
        arcMax: arc,
        arcDefault: arc,
        radiusMin,
        radiusMax,
        arcAdjustable: false,
        radiusAdjustable: true,
      }
    ),
    nozzleChart: buildNozzleChart(points, recommendedPsi),
  };
}

function variableArcSpray(
  id: string,
  model: string,
  family: string,
  radiusMin: number,
  radiusMax: number,
  points: ChartPoint[],
  recommendedPsi = 30
): CatalogSeedItem {
  return {
    id,
    category: "SPRAY",
    manufacturer: "Rain Bird",
    model,
    specs: sprayNozzleSpecs(
      {
        nozzleFamily: family,
        compatibleHeadFamilies: RB_1800_HEADS,
        chartReferenceArcDegrees: 180,
      },
      {
        arcMin: 0,
        arcMax: 360,
        arcDefault: 180,
        radiusMin,
        radiusMax,
        arcAdjustable: true,
        radiusAdjustable: true,
      }
    ),
    nozzleChart: buildNozzleChart(points, recommendedPsi),
  };
}

type StripPattern = "left_corner" | "right_corner" | "side" | "end" | "center";

function stripSpray(
  id: string,
  model: string,
  family: string,
  stripPattern: StripPattern,
  widthFt: number,
  lengthFt: number,
  rows: [pressurePsi: number, widthFt: number, lengthFt: number, gpm: number, precipSq: number, precipTri: number][],
  recommendedPsi = 30
): CatalogSeedItem {
  const points = rows.map(([pressurePsi, w, l, gpm, precipSqInPerHr, precipTriInPerHr]) => ({
    pressurePsi,
    radiusFeet: l,
    gpm,
    precipSqInPerHr,
    precipTriInPerHr,
  }));
  const lengths = rows.map((r) => r[2]);
  const minLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);

  return {
    id,
    category: "SPRAY",
    manufacturer: "Rain Bird",
    model,
    specs: sprayNozzleSpecs(
      {
        nozzleFamily: family,
        compatibleHeadFamilies: RB_1800_HEADS,
        stripPattern,
        patternWidthFt: widthFt,
        patternLengthFt: lengthFt,
        patternSize: `${widthFt}' x ${lengthFt}'`,
      },
      {
        arcMin: 180,
        arcMax: 180,
        arcDefault: 180,
        radiusMin: minLength,
        radiusMax: maxLength,
        arcAdjustable: false,
        radiusAdjustable: false,
      }
    ),
    nozzleChart: buildNozzleChart(points, recommendedPsi),
  };
}

/** MPR / U-Series performance at 180° reference (30 psi optimum). */
const SERIES_8_CHARTS: Record<ArcPattern, ChartPoint[]> = {
  F: chartRows([
    [15, 5, 0.74, 2.85, 3.29],
    [20, 6, 0.86, 2.3, 2.66],
    [25, 7, 0.96, 1.89, 2.18],
    [30, 8, 1.05, 1.58, 1.83],
  ]),
  H: chartRows([
    [15, 5, 0.37, 2.85, 3.29],
    [20, 6, 0.42, 2.25, 2.59],
    [25, 7, 0.47, 1.85, 2.13],
    [30, 8, 0.52, 1.58, 1.83],
  ]),
  Q: chartRows([
    [15, 5, 0.18, 2.77, 3.2],
    [20, 6, 0.21, 2.25, 2.59],
    [25, 7, 0.24, 1.89, 2.18],
    [30, 8, 0.26, 1.56, 1.81],
  ]),
};

const SERIES_10_CHARTS: Record<ArcPattern, ChartPoint[]> = {
  F: chartRows([
    [15, 7, 1.16, 2.28, 2.63],
    [20, 8, 1.34, 2.01, 2.32],
    [25, 9, 1.5, 1.62, 1.87],
    [30, 10, 1.64, 1.58, 1.83],
  ]),
  H: chartRows([
    [15, 7, 0.58, 2.28, 2.63],
    [20, 8, 0.67, 2.01, 2.32],
    [25, 9, 0.75, 1.62, 1.87],
    [30, 10, 0.82, 1.58, 1.83],
  ]),
  Q: chartRows([
    [15, 7, 0.29, 2.28, 2.63],
    [20, 8, 0.33, 2.01, 2.32],
    [25, 9, 0.37, 1.62, 1.87],
    [30, 10, 0.41, 1.58, 1.83],
  ]),
};

const SERIES_12_CHARTS: Record<ArcPattern, ChartPoint[]> = {
  F: chartRows([
    [15, 9, 1.8, 2.14, 2.47],
    [20, 10, 2.1, 2.02, 2.34],
    [25, 11, 2.4, 1.91, 2.21],
    [30, 12, 2.6, 1.74, 2.01],
  ]),
  H: chartRows([
    [15, 9, 0.9, 2.14, 2.47],
    [20, 10, 1.05, 2.02, 2.34],
    [25, 11, 1.2, 1.91, 2.21],
    [30, 12, 1.3, 1.74, 2.01],
  ]),
  Q: chartRows([
    [15, 9, 0.45, 2.14, 2.47],
    [20, 10, 0.53, 2.02, 2.34],
    [25, 11, 0.6, 1.91, 2.21],
    [30, 12, 0.65, 1.74, 2.01],
  ]),
};

const SERIES_15_CHARTS: Record<ArcPattern, ChartPoint[]> = {
  F: chartRows([
    [15, 11, 2.6, 2.07, 2.39],
    [20, 12, 3.0, 2.01, 2.32],
    [25, 14, 3.3, 1.62, 1.87],
    [30, 15, 3.7, 1.58, 1.83],
  ]),
  H: chartRows([
    [15, 11, 1.3, 2.07, 2.39],
    [20, 12, 1.5, 2.01, 2.32],
    [25, 14, 1.65, 1.62, 1.87],
    [30, 15, 1.85, 1.58, 1.83],
  ]),
  Q: chartRows([
    [15, 11, 0.65, 2.07, 2.39],
    [20, 12, 0.75, 2.01, 2.32],
    [25, 14, 0.82, 1.62, 1.87],
    [30, 15, 0.92, 1.58, 1.83],
  ]),
};

const SERIES_5_CHARTS: Record<ArcPattern, ChartPoint[]> = {
  F: chartRows([
    [15, 3, 0.29, 3.1, 3.58],
    [20, 4, 0.33, 1.99, 2.29],
    [25, 4, 0.37, 2.23, 2.57],
    [30, 5, 0.41, 1.58, 1.83],
  ]),
  H: chartRows([
    [15, 3, 0.14, 3.0, 3.46],
    [20, 4, 0.16, 1.93, 2.22],
    [25, 4, 0.18, 2.17, 2.5],
    [30, 5, 0.2, 1.54, 1.78],
  ]),
  Q: chartRows([
    [15, 3, 0.07, 3.0, 3.46],
    [20, 4, 0.08, 1.93, 2.22],
    [25, 4, 0.09, 2.17, 2.5],
    [30, 5, 0.1, 1.54, 1.78],
  ]),
};

function mprSeries(
  series: number,
  radiusMin: number,
  radiusMax: number,
  charts: Record<ArcPattern, ChartPoint[]>
): CatalogSeedItem[] {
  return (["Q", "H", "F"] as const).map((pattern) =>
    fixedArcSpray(
      `noz_rb_mpr_${series}${pattern.toLowerCase()}`,
      `${series}${pattern}`,
      "rainbird_mpr",
      pattern,
      radiusMin,
      radiusMax,
      charts[pattern]
    )
  );
}

function uSeries(
  series: number,
  radiusMin: number,
  radiusMax: number,
  charts: Record<ArcPattern, ChartPoint[]>
): CatalogSeedItem[] {
  return (["Q", "H", "F"] as const).map((pattern) =>
    fixedArcSpray(
      `noz_rb_u_${series}${pattern.toLowerCase()}`,
      `U-${series}${pattern}`,
      "rainbird_u_series",
      pattern,
      radiusMin,
      radiusMax,
      charts[pattern]
    )
  );
}

const HE_VAN_MODELS: Array<{
  id: string;
  model: string;
  radiusMin: number;
  radiusMax: number;
  points: ChartPoint[];
}> = [
  {
    id: "noz_rb_he_van_08",
    model: "HE-VAN-08",
    radiusMin: 6,
    radiusMax: 8,
    points: chartRows([
      [15, 5, 0.41, 3.19, 3.68],
      [20, 6, 0.48, 2.56, 2.95],
      [25, 7, 0.53, 2.1, 2.42],
      [30, 8, 0.59, 1.76, 2.03],
    ]),
  },
  {
    id: "noz_rb_he_van_10",
    model: "HE-VAN-10",
    radiusMin: 8,
    radiusMax: 10,
    points: chartRows([
      [15, 7, 0.63, 2.48, 2.86],
      [20, 8, 0.73, 2.19, 2.53],
      [25, 9, 0.81, 1.94, 2.24],
      [30, 10, 0.89, 1.72, 1.98],
    ]),
  },
  {
    id: "noz_rb_he_van_12",
    model: "HE-VAN-12",
    radiusMin: 9,
    radiusMax: 12,
    points: chartRows([
      [15, 9, 0.84, 1.99, 2.3],
      [20, 10, 0.97, 1.86, 2.15],
      [25, 11, 1.08, 1.72, 1.99],
      [30, 12, 1.18, 1.58, 1.83],
    ]),
  },
  {
    id: "noz_rb_he_van_15",
    model: "HE-VAN-15",
    radiusMin: 12,
    radiusMax: 15,
    points: chartRows([
      [15, 11, 1.31, 2.08, 2.4],
      [20, 12, 1.51, 2.02, 2.33],
      [25, 14, 1.69, 1.66, 1.92],
      [30, 15, 1.85, 1.58, 1.83],
    ]),
  },
];

const VAN_MODELS: Array<{
  id: string;
  model: string;
  radiusMin: number;
  radiusMax: number;
  points: ChartPoint[];
}> = [
  {
    id: "noz_rb_van_4",
    model: "4-VAN",
    radiusMin: 3,
    radiusMax: 4,
    points: chartRows([
      [15, 3, 0.32, 6.84, 7.9],
      [20, 3, 0.37, 7.91, 9.13],
      [25, 4, 0.41, 4.93, 5.69],
      [30, 4, 0.45, 5.41, 6.25],
    ]),
  },
  {
    id: "noz_rb_van_6",
    model: "6-VAN",
    radiusMin: 4,
    radiusMax: 6,
    points: chartRows([
      [15, 4, 0.42, 5.05, 5.83],
      [20, 5, 0.49, 3.77, 4.35],
      [25, 5, 0.55, 4.24, 4.9],
      [30, 6, 0.6, 3.21, 3.71],
    ]),
  },
  {
    id: "noz_rb_van_8",
    model: "8-VAN",
    radiusMin: 6,
    radiusMax: 8,
    points: chartRows([
      [15, 6, 0.56, 3.36, 3.88],
      [20, 7, 0.65, 2.91, 3.36],
      [25, 7, 0.72, 2.6, 3.01],
      [30, 8, 0.79, 2.38, 2.75],
    ]),
  },
  {
    id: "noz_rb_van_10",
    model: "10-VAN",
    radiusMin: 7,
    radiusMax: 10,
    points: chartRows([
      [15, 7, 0.97, 3.8, 4.39],
      [20, 8, 1.12, 3.36, 3.88],
      [25, 9, 1.25, 2.96, 3.42],
      [30, 10, 1.37, 2.64, 3.05],
    ]),
  },
  {
    id: "noz_rb_van_12",
    model: "12-VAN",
    radiusMin: 9,
    radiusMax: 12,
    points: chartRows([
      [15, 9, 1.35, 2.67, 3.08],
      [20, 10, 1.57, 2.4, 2.77],
      [25, 11, 1.77, 2.17, 2.5],
      [30, 12, 1.95, 2.01, 2.32],
    ]),
  },
  {
    id: "noz_rb_van_15",
    model: "15-VAN",
    radiusMin: 11,
    radiusMax: 15,
    points: chartRows([
      [15, 11, 1.75, 2.31, 2.67],
      [20, 12, 2.03, 2.13, 2.46],
      [25, 14, 2.28, 1.72, 1.99],
      [30, 15, 2.5, 1.6, 1.85],
    ]),
  },
  {
    id: "noz_rb_van_18",
    model: "18-VAN",
    radiusMin: 14,
    radiusMax: 18,
    points: chartRows([
      [15, 14, 2.15, 1.76, 2.03],
      [20, 15, 2.48, 1.67, 1.93],
      [25, 16, 2.78, 1.55, 1.79],
      [30, 18, 3.05, 1.52, 1.75],
    ]),
  },
];

const STRIP_15_ROWS: Record<
  string,
  [pressurePsi: number, widthFt: number, lengthFt: number, gpm: number, precipSq: number, precipTri: number][]
> = {
  "15EST": [
    [15, 4, 13, 0.45, 2.0, 2.3],
    [20, 4, 14, 0.5, 1.9, 2.2],
    [25, 4, 14, 0.56, 2.1, 2.4],
    [30, 4, 15, 0.61, 2.0, 2.3],
  ],
  "15CST": [
    [15, 4, 26, 0.89, 1.9, 2.2],
    [20, 4, 28, 1.0, 1.9, 2.2],
    [25, 4, 28, 1.11, 2.1, 2.4],
    [30, 4, 30, 1.21, 1.9, 2.2],
  ],
  "15RCS": [
    [15, 3, 11, 0.35, 2.0, 2.3],
    [20, 3, 12, 0.4, 1.9, 2.2],
    [25, 4, 14, 0.45, 2.0, 2.3],
    [30, 4, 15, 0.49, 1.9, 2.2],
  ],
  "15LCS": [
    [15, 3, 11, 0.35, 2.0, 2.3],
    [20, 3, 12, 0.4, 1.9, 2.2],
    [25, 4, 14, 0.45, 2.0, 2.3],
    [30, 4, 15, 0.49, 1.9, 2.2],
  ],
  "15SST": [
    [15, 4, 26, 0.89, 1.9, 2.2],
    [20, 4, 28, 1.0, 1.9, 2.2],
    [25, 4, 28, 1.11, 2.1, 2.4],
    [30, 4, 30, 1.21, 1.9, 2.2],
  ],
  "9SST": [
    [15, 9, 15, 1.34, 2.0, 2.3],
    [20, 9, 16, 1.47, 1.9, 2.2],
    [25, 9, 18, 1.6, 2.0, 2.3],
    [30, 9, 18, 1.73, 1.9, 2.2],
  ],
};

const STRIP_15_META: Record<string, { stripPattern: StripPattern; widthFt: number; lengthFt: number }> = {
  "15EST": { stripPattern: "end", widthFt: 4, lengthFt: 15 },
  "15CST": { stripPattern: "center", widthFt: 4, lengthFt: 30 },
  "15RCS": { stripPattern: "right_corner", widthFt: 4, lengthFt: 15 },
  "15LCS": { stripPattern: "left_corner", widthFt: 4, lengthFt: 15 },
  "15SST": { stripPattern: "side", widthFt: 4, lengthFt: 30 },
  "9SST": { stripPattern: "side", widthFt: 9, lengthFt: 18 },
};

export const RAINBIRD_SPRAY_NOZZLES: CatalogSeedItem[] = [
  ...HE_VAN_MODELS.map((m) =>
    variableArcSpray(m.id, m.model, "rainbird_he_van", m.radiusMin, m.radiusMax, m.points)
  ),
  ...mprSeries(5, 3, 5, SERIES_5_CHARTS),
  ...mprSeries(8, 5, 8, SERIES_8_CHARTS),
  ...mprSeries(10, 7, 10, SERIES_10_CHARTS),
  ...mprSeries(12, 9, 12, SERIES_12_CHARTS),
  ...mprSeries(15, 11, 15, SERIES_15_CHARTS),
  fixedArcSpray(
    "noz_rb_mpr_8h_flt",
    "8H-FLT",
    "rainbird_mpr",
    "H",
    6,
    8,
    chartRows([
      [15, 6, 0.56, 3.36, 3.88],
      [20, 7, 0.65, 2.91, 3.36],
      [25, 7, 0.72, 2.6, 3.01],
      [30, 8, 0.79, 2.38, 2.75],
    ])
  ),
  fixedArcSpray(
    "noz_rb_mpr_8q_flt",
    "8Q-FLT",
    "rainbird_mpr",
    "Q",
    6,
    8,
    chartRows([
      [15, 6, 0.28, 3.32, 3.83],
      [20, 7, 0.32, 2.87, 3.32],
      [25, 7, 0.36, 2.57, 2.97],
      [30, 8, 0.39, 2.35, 2.71],
    ])
  ),
  ...uSeries(8, 5, 8, SERIES_8_CHARTS),
  ...uSeries(10, 7, 10, SERIES_10_CHARTS),
  ...uSeries(12, 9, 12, SERIES_12_CHARTS),
  ...uSeries(15, 11, 15, SERIES_15_CHARTS),
  ...VAN_MODELS.map((m) =>
    variableArcSpray(m.id, m.model, "rainbird_van", m.radiusMin, m.radiusMax, m.points)
  ),
  ...Object.entries(STRIP_15_META).map(([model, meta]) =>
    stripSpray(
      `noz_rb_${model.toLowerCase()}`,
      model,
      "rainbird_mpr_strip",
      meta.stripPattern,
      meta.widthFt,
      meta.lengthFt,
      STRIP_15_ROWS[model]
    )
  ),
  fixedArcSpray(
    "noz_rb_sq_qtr",
    "SQ-QTR",
    "rainbird_sq",
    "Q",
    2.5,
    4,
    chartRows([
      [30, 2.5, 0.1, 3.0, 3.5],
      [40, 3, 0.12, 2.8, 3.2],
      [50, 4, 0.14, 2.5, 2.9],
    ]),
    30
  ),
  fixedArcSpray(
    "noz_rb_sq_hlf",
    "SQ-HLF",
    "rainbird_sq",
    "H",
    2.5,
    4,
    chartRows([
      [30, 2.5, 0.2, 3.0, 3.5],
      [40, 3, 0.24, 2.8, 3.2],
      [50, 4, 0.28, 2.5, 2.9],
    ]),
    30
  ),
  fixedArcSpray(
    "noz_rb_sq_ful",
    "SQ-FUL",
    "rainbird_sq",
    "F",
    2.5,
    4,
    chartRows([
      [30, 2.5, 0.4, 3.0, 3.5],
      [40, 3, 0.48, 2.8, 3.2],
      [50, 4, 0.56, 2.5, 2.9],
    ]),
    30
  ),
];

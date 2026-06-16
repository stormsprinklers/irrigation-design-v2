export type ChartPoint = {
  pressurePsi: number;
  radiusFeet: number;
  gpm: number;
  precipSqInPerHr: number;
  precipTriInPerHr: number;
};

export type NozzleChart = {
  pressurePsi: number[];
  radiusFeet: number[];
  gpm: number[];
  precipInPerHr: number[];
  precipTriInPerHr: number[];
  recommendedPressurePsi?: number;
};

export function buildNozzleChart(
  points: ChartPoint[],
  recommendedPressurePsi?: number
): NozzleChart {
  return {
    pressurePsi: points.map((p) => p.pressurePsi),
    radiusFeet: points.map((p) => p.radiusFeet),
    gpm: points.map((p) => p.gpm),
    precipInPerHr: points.map((p) => p.precipSqInPerHr),
    precipTriInPerHr: points.map((p) => p.precipTriInPerHr),
    ...(recommendedPressurePsi !== undefined ? { recommendedPressurePsi } : {}),
  };
}

export type CatalogSeedItem = {
  id: string;
  category: string;
  manufacturer: string;
  model: string;
  specs: Record<string, unknown>;
  nozzleChart?: NozzleChart;
};

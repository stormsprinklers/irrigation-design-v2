import type { NozzleAdjustability } from "@/lib/catalog/adjustability";
import type { Point } from "../types";
import type { PolygonAnalysis } from "./geometry";

export type EdgeRun = {
  edgeIndex: number;
  start: Point;
  end: Point;
  lengthFt: number;
  spanCount: number;
  spacingFt: number;
  interiorTs: number[];
};

export function planEdgeRuns(analysis: PolygonAnalysis, radiusFeet: number): EdgeRun[] {
  const runs: EdgeRun[] = [];
  const n = analysis.vertices.length;
  const r = Math.max(radiusFeet, 1);

  for (let i = 0; i < n; i++) {
    const L = analysis.edgeLengthsFt[i];
    if (L <= 0) continue;

    const spanCount = Math.max(1, Math.round(L / r));
    const spacingFt = L / spanCount;
    const interiorTs: number[] = [];
    for (let k = 1; k < spanCount; k++) {
      interiorTs.push(k / spanCount);
    }

    runs.push({
      edgeIndex: i,
      start: analysis.vertices[i],
      end: analysis.vertices[(i + 1) % n],
      lengthFt: L,
      spanCount,
      spacingFt,
      interiorTs,
    });
  }

  return runs;
}

export function resolveHydrozoneSpacing(
  analysis: PolygonAnalysis,
  nozzleAdj: NozzleAdjustability,
  initialRadiusFeet: number
): { radiusFeet: number; runs: EdgeRun[] } {
  let runs = planEdgeRuns(analysis, initialRadiusFeet);
  const spacings = runs.map((r) => r.spacingFt);

  if (spacings.length === 0) {
    const radiusFeet = Math.min(
      nozzleAdj.radiusFeetMax,
      Math.max(nozzleAdj.radiusFeetMin, initialRadiusFeet)
    );
    return { radiusFeet, runs };
  }

  spacings.sort((a, b) => a - b);
  const medianS = spacings[Math.floor(spacings.length / 2)] ?? initialRadiusFeet;

  let radiusFeet = medianS;
  if (nozzleAdj.radiusAdjustable) {
    radiusFeet = Math.min(nozzleAdj.radiusFeetMax, Math.max(nozzleAdj.radiusFeetMin, medianS));
  } else {
    radiusFeet = Math.min(nozzleAdj.radiusFeetMax, Math.max(nozzleAdj.radiusFeetMin, medianS));
  }

  runs = planEdgeRuns(analysis, radiusFeet);
  return { radiusFeet, runs };
}

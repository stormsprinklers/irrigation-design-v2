import { feetToPixels } from "../hydraulics";
import type { SprinklerHead, ValidationIssue } from "../types";
import { samplePointsInPolygon, type PolygonAnalysis } from "./geometry";
import { overlapCountAtPoint } from "./wedge";

export type CoverageResult = {
  coveragePercent: number;
  overlapPercent: number;
  lowOverlapPercent: number;
  sampleCount: number;
};

export function evaluateCoverage(
  heads: SprinklerHead[],
  analysis: PolygonAnalysis,
  ppf: number,
  hydrozoneId: string,
  hydrozoneName: string,
  radiusFeet: number
): { coverage: CoverageResult; warnings: ValidationIssue[] } {
  const warnings: ValidationIssue[] = [];
  const samples = samplePointsInPolygon(analysis.vertices, ppf, 2);
  if (samples.length === 0) {
    return {
      coverage: { coveragePercent: 0, overlapPercent: 0, lowOverlapPercent: 0, sampleCount: 0 },
      warnings,
    };
  }

  let overlap2Plus = 0;
  let overlap1Only = 0;
  let anyCoverage = 0;

  for (const p of samples) {
    const count = overlapCountAtPoint(p, heads, ppf);
    if (count >= 1) anyCoverage++;
    if (count >= 2) overlap2Plus++;
    if (count === 1) overlap1Only++;
  }

  const overlapPercent = Math.round((overlap2Plus / samples.length) * 100);
  const lowOverlapPercent = Math.round((overlap1Only / samples.length) * 100);
  const coveragePercent = overlapPercent;

  if (overlapPercent < 85) {
    warnings.push({
      code: "COVERAGE_GAP",
      severity: "warning",
      message: `Head-to-head overlap is ${overlapPercent}% in ${hydrozoneName} (target ≥85%)`,
      entityIds: [hydrozoneId],
      suggestedAction: "Add manual heads or adjust spacing",
    });
  }

  if (lowOverlapPercent > 15) {
    warnings.push({
      code: "LOW_OVERLAP",
      severity: "info",
      message: `${lowOverlapPercent}% of ${hydrozoneName} has single-head coverage only`,
      entityIds: [hydrozoneId],
      suggestedAction: "Adjust head spacing for uniform overlap",
    });
  }

  if (heads.length > 1) {
    const idealSpacingPx = feetToPixels(radiusFeet, ppf);
    let spacingIssues = 0;
    for (let i = 0; i < heads.length; i++) {
      for (let j = i + 1; j < heads.length; j++) {
        const d = Math.hypot(
          heads[i].position.x - heads[j].position.x,
          heads[i].position.y - heads[j].position.y
        );
        if (d > idealSpacingPx * 1.08 && d < idealSpacingPx * 2.5) spacingIssues++;
      }
    }
    if (spacingIssues > 0) {
      warnings.push({
        code: "HEAD_SPACING",
        severity: "warning",
        message: `${spacingIssues} head pairs exceed ideal head-to-head spacing by 8%`,
        entityIds: heads.map((h) => h.id),
      });
    }
  }

  void anyCoverage;
  return {
    coverage: {
      coveragePercent,
      overlapPercent,
      lowOverlapPercent,
      sampleCount: samples.length,
    },
    warnings,
  };
}

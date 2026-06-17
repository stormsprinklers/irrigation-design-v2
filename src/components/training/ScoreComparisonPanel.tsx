"use client";

import { useTrainingStore } from "@/lib/stores/training-store";
import type { UniformityScores } from "@/lib/domain/training/types";

function MetricRow({
  label,
  baseline,
  corrected,
  format = (v: number) => String(v),
}: {
  label: string;
  baseline: number;
  corrected: number;
  format?: (v: number) => string;
}) {
  const delta = corrected - baseline;
  const deltaStr = delta > 0 ? `+${format(delta)}` : format(delta);
  return (
    <tr className="border-b">
      <td className="py-1.5 pr-4 text-sm">{label}</td>
      <td className="py-1.5 text-right text-sm tabular-nums">{format(baseline)}</td>
      <td className="py-1.5 text-right text-sm tabular-nums">{format(corrected)}</td>
      <td
        className={`py-1.5 pl-2 text-right text-xs tabular-nums ${
          delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-muted-foreground"
        }`}
      >
        {deltaStr}
      </td>
    </tr>
  );
}

function ScoreTable({
  title,
  baseline,
  corrected,
}: {
  title: string;
  baseline: UniformityScores;
  corrected: UniformityScores;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">{title}</h4>
      <table className="w-full">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="pb-1 text-left font-normal">Metric</th>
            <th className="pb-1 text-right font-normal">Baseline</th>
            <th className="pb-1 text-right font-normal">Corrected</th>
            <th className="pb-1 text-right font-normal">Δ</th>
          </tr>
        </thead>
        <tbody>
          <MetricRow label="Coverage %" baseline={baseline.coveragePercent} corrected={corrected.coveragePercent} />
          <MetricRow label="DU_LQ" baseline={baseline.duLq} corrected={corrected.duLq} format={(v) => v.toFixed(3)} />
          <MetricRow label="Avg precip" baseline={baseline.avgPrecip} corrected={corrected.avgPrecip} format={(v) => v.toFixed(2)} />
          <MetricRow label="Min precip" baseline={baseline.minPrecip} corrected={corrected.minPrecip} format={(v) => v.toFixed(2)} />
          <MetricRow label="Max precip" baseline={baseline.maxPrecip} corrected={corrected.maxPrecip} format={(v) => v.toFixed(2)} />
          <MetricRow label="Dry spots" baseline={baseline.drySpotCount} corrected={corrected.drySpotCount} />
          <MetricRow label="Wet spots" baseline={baseline.wetSpotCount} corrected={corrected.wetSpotCount} />
          <MetricRow label="H2H violations" baseline={baseline.headToHeadViolations} corrected={corrected.headToHeadViolations} />
          <MetricRow label="Overspray est. %" baseline={baseline.oversprayEstimatePercent} corrected={corrected.oversprayEstimatePercent} />
          <MetricRow label="Head count" baseline={baseline.headCount} corrected={corrected.headCount} />
        </tbody>
      </table>
    </div>
  );
}

export function ScoreComparisonPanel() {
  const baselineScores = useTrainingStore((s) => s.baselineScores);
  const correctedScores = useTrainingStore((s) => s.correctedScores);
  const improvementScore = useTrainingStore((s) => s.improvementScore);
  const polygon = useTrainingStore((s) => s.polygon);

  if (!polygon || !baselineScores || !correctedScores) {
    return (
      <div className="border-t p-4 text-sm text-muted-foreground">
        Generate an example to see uniformity scores.
      </div>
    );
  }

  return (
    <div className="border-t p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium">Uniformity scores</h3>
        <span className="text-sm">
          Improvement:{" "}
          <strong className={improvementScore >= 0 ? "text-green-600" : "text-red-600"}>
            {improvementScore >= 0 ? "+" : ""}
            {improvementScore.toFixed(1)}
          </strong>
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {polygon.metadata.shapeClass} · {polygon.metadata.areaSqFt} ft² · seed {polygon.metadata.seed}
      </p>
      <ScoreTable title="Before / After" baseline={baselineScores} corrected={correctedScores} />
    </div>
  );
}

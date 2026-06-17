"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listTrainingExamples,
  rescoreStaleTrainingExamples,
  rescoreTrainingExample,
} from "@/lib/actions/training";

type ExampleRow = Awaited<ReturnType<typeof listTrainingExamples>>[number];

export function ExampleListDrawer() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ExampleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [rescoringId, setRescoringId] = useState<string | null>(null);
  const [rescoringAll, setRescoringAll] = useState(false);

  function loadRows() {
    setLoading(true);
    return listTrainingExamples("APPROVED")
      .then(setRows)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!open) return;
    loadRows();
  }, [open]);

  const staleCount = rows.filter((row) => row.needsRescore).length;

  async function handleRescore(id: string) {
    setRescoringId(id);
    try {
      await rescoreTrainingExample(id);
      toast.success("Example re-scored with current distribution curve");
      await loadRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Re-score failed");
    } finally {
      setRescoringId(null);
    }
  }

  async function handleRescoreAll() {
    setRescoringAll(true);
    try {
      const { rescored } = await rescoreStaleTrainingExamples();
      toast.success(
        rescored > 0
          ? `Re-scored ${rescored} example${rescored === 1 ? "" : "s"}`
          : "No examples needed re-scoring"
      );
      await loadRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk re-score failed");
    } finally {
      setRescoringAll(false);
    }
  }

  return (
    <div className="border-t" data-tour="training-tour-saved">
      <button
        type="button"
        className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-accent"
        onClick={() => setOpen(!open)}
      >
        Saved examples ({open ? rows.length : "…"})
      </button>
      {open && (
        <div className="max-h-56 overflow-auto px-4 pb-3">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-xs text-muted-foreground">No approved examples yet.</p>
          )}
          {staleCount > 0 && (
            <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              {staleCount} example{staleCount === 1 ? "" : "s"} need re-scoring for the
              current precip curve.
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-7 w-full"
                disabled={rescoringAll}
                onClick={handleRescoreAll}
              >
                {rescoringAll ? "Re-scoring…" : "Re-score all stale"}
              </Button>
            </div>
          )}
          <ul className="space-y-2">
            {rows.map((row) => {
              const meta = row.polygonMetadata as {
                shapeClass?: string;
                areaSqFt?: number;
                seed?: number;
              };
              return (
                <li key={row.id} className="rounded border px-2 py-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{meta.shapeClass ?? "polygon"}</div>
                    {row.needsRescore ? (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        Needs re-score
                      </span>
                    ) : row.validForTraining ? (
                      <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                        Training ready
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground">
                    {meta.areaSqFt?.toFixed(0) ?? "?"} ft² · {row.distributionCurveVersion ?? "legacy"}
                  </div>
                  <div className="text-muted-foreground">
                    {new Date(row.approvedAt ?? row.createdAt).toLocaleString()}
                  </div>
                  {row.needsRescore && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-1.5 h-7 w-full"
                      disabled={rescoringId === row.id || rescoringAll}
                      onClick={() => handleRescore(row.id)}
                    >
                      {rescoringId === row.id ? "Re-scoring…" : "Re-score"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

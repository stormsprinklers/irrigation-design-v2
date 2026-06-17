"use client";

import { useEffect, useState } from "react";
import { listTrainingExamples } from "@/lib/actions/training";

type ExampleRow = Awaited<ReturnType<typeof listTrainingExamples>>[number];

export function ExampleListDrawer() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ExampleRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listTrainingExamples("APPROVED")
      .then(setRows)
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <div className="border-t">
      <button
        type="button"
        className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-accent"
        onClick={() => setOpen(!open)}
      >
        Saved examples ({open ? rows.length : "…"})
      </button>
      {open && (
        <div className="max-h-48 overflow-auto px-4 pb-3">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-xs text-muted-foreground">No approved examples yet.</p>
          )}
          <ul className="space-y-2">
            {rows.map((row) => {
              const meta = row.polygonMetadata as { shapeClass?: string; areaSqFt?: number; seed?: number };
              return (
                <li key={row.id} className="rounded border px-2 py-1.5 text-xs">
                  <div className="font-medium">{meta.shapeClass ?? "polygon"}</div>
                  <div className="text-muted-foreground">
                    {meta.areaSqFt?.toFixed(0) ?? "?"} ft² · {row.algorithmVersion}
                  </div>
                  <div className="text-muted-foreground">
                    {new Date(row.approvedAt ?? row.createdAt).toLocaleString()}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

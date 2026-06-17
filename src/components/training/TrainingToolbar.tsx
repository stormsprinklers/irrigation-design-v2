"use client";

import { Button } from "@/components/ui/button";
import { useTrainingStore } from "@/lib/stores/training-store";
import type { TrainingShapeClass } from "@/lib/domain/training/types";

const SHAPES: { value: TrainingShapeClass | "random"; label: string }[] = [
  { value: "random", label: "Random shape" },
  { value: "rectangle", label: "Rectangle" },
  { value: "l_shape", label: "L-shape" },
  { value: "narrow_strip", label: "Narrow strip" },
  { value: "concave", label: "Concave notch" },
  { value: "front_yard", label: "Front yard" },
  { value: "back_yard", label: "Back yard" },
  { value: "irregular", label: "Irregular" },
];

type Props = {
  onApprove: () => void;
  onExport: () => void;
  approving: boolean;
};

export function TrainingToolbar({ onApprove, onExport, approving }: Props) {
  const generateExample = useTrainingStore((s) => s.generateExample);
  const shapeFilter = useTrainingStore((s) => s.shapeFilter);
  const setShapeFilter = useTrainingStore((s) => s.setShapeFilter);
  const viewMode = useTrainingStore((s) => s.viewMode);
  const setViewMode = useTrainingStore((s) => s.setViewMode);
  const tool = useTrainingStore((s) => s.tool);
  const setTool = useTrainingStore((s) => s.setTool);
  const showHeatmap = useTrainingStore((s) => s.showHeatmap);
  const showSampleGrid = useTrainingStore((s) => s.showSampleGrid);
  const showArcs = useTrainingStore((s) => s.showArcs);
  const toggleHeatmap = useTrainingStore((s) => s.toggleHeatmap);
  const toggleSampleGrid = useTrainingStore((s) => s.toggleSampleGrid);
  const toggleArcs = useTrainingStore((s) => s.toggleArcs);
  const resetToBaseline = useTrainingStore((s) => s.resetToBaseline);
  const polygon = useTrainingStore((s) => s.polygon);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-card p-3">
      <select
        className="rounded-md border px-2 py-1.5 text-sm"
        value={shapeFilter}
        onChange={(e) => setShapeFilter(e.target.value as TrainingShapeClass | "random")}
      >
        {SHAPES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <Button size="sm" onClick={() => generateExample()}>
        Generate
      </Button>
      <Button size="sm" variant="outline" onClick={() => generateExample()} disabled={!polygon}>
        Next example
      </Button>
      <Button size="sm" variant="outline" onClick={resetToBaseline} disabled={!polygon}>
        Reset to algorithm
      </Button>
      <div className="mx-2 h-6 w-px bg-border" />
      <Button
        size="sm"
        variant={viewMode === "baseline" ? "default" : "outline"}
        onClick={() => setViewMode("baseline")}
      >
        Baseline
      </Button>
      <Button
        size="sm"
        variant={viewMode === "corrected" ? "default" : "outline"}
        onClick={() => setViewMode("corrected")}
      >
        Corrected
      </Button>
      <Button
        size="sm"
        variant={viewMode === "compare" ? "default" : "outline"}
        onClick={() => setViewMode("compare")}
      >
        Compare
      </Button>
      <div className="mx-2 h-6 w-px bg-border" />
      <Button size="sm" variant={tool === "select" ? "default" : "outline"} onClick={() => setTool("select")}>
        Select
      </Button>
      <Button size="sm" variant={tool === "add" ? "default" : "outline"} onClick={() => setTool("add")}>
        Add head
      </Button>
      <div className="mx-2 h-6 w-px bg-border" />
      <Button size="sm" variant={showHeatmap ? "default" : "outline"} onClick={toggleHeatmap}>
        Heatmap
      </Button>
      <Button size="sm" variant={showSampleGrid ? "default" : "outline"} onClick={toggleSampleGrid}>
        Grid
      </Button>
      <Button size="sm" variant={showArcs ? "default" : "outline"} onClick={toggleArcs}>
        Arcs
      </Button>
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" onClick={onExport}>
          Export JSONL
        </Button>
        <Button size="sm" onClick={onApprove} disabled={!polygon || approving}>
          {approving ? "Saving…" : "Approve & Save"}
        </Button>
      </div>
    </div>
  );
}

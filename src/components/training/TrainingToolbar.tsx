"use client";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useTrainingStore } from "@/lib/stores/training-store";
import {
  TRAINING_SHAPE_CLASSES,
  TRAINING_SHAPE_LABELS,
  type TrainingShapeClass,
} from "@/lib/domain/training/types";

const SHAPES: { value: TrainingShapeClass | "random"; label: string }[] = [
  { value: "random", label: "Random shape" },
  ...TRAINING_SHAPE_CLASSES.map((value) => ({
    value,
    label: TRAINING_SHAPE_LABELS[value],
  })),
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
  const clearCorrectedHeads = useTrainingStore((s) => s.clearCorrectedHeads);
  const polygon = useTrainingStore((s) => s.polygon);
  const correctedHeads = useTrainingStore((s) => s.correctedHeads);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-card p-3">
      <div className="flex items-center gap-2" data-tour="training-tour-generate">
        <NativeSelect
          className="w-auto"
          value={shapeFilter}
          onChange={(e) => setShapeFilter(e.target.value as TrainingShapeClass | "random")}
        >
          {SHAPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
        <Button size="sm" onClick={() => generateExample()}>
          Generate
        </Button>
        <Button size="sm" variant="outline" onClick={() => generateExample()} disabled={!polygon}>
          Next example
        </Button>
        <Button size="sm" variant="outline" onClick={resetToBaseline} disabled={!polygon}>
          Reset to algorithm
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!polygon || correctedHeads.length === 0}
          onClick={() => {
            if (
              !window.confirm(
                "Remove all heads from your corrected design? The algorithm baseline is unchanged — use Add head to place sprinklers from scratch."
              )
            ) {
              return;
            }
            clearCorrectedHeads();
          }}
        >
          Clear heads
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border" />
      <div className="flex items-center gap-2" data-tour="training-tour-view-modes">
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
      </div>
      <div className="mx-2 h-6 w-px bg-border" />
      <div className="flex items-center gap-2" data-tour="training-tour-tools">
        <Button size="sm" variant={tool === "select" ? "default" : "outline"} onClick={() => setTool("select")}>
          Select
        </Button>
        <Button size="sm" variant={tool === "add" ? "default" : "outline"} onClick={() => setTool("add")}>
          Add head
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border" />
      <div className="flex items-center gap-2" data-tour="training-tour-overlays">
        <Button size="sm" variant={showHeatmap ? "default" : "outline"} onClick={toggleHeatmap}>
          Heatmap
        </Button>
        <Button size="sm" variant={showSampleGrid ? "default" : "outline"} onClick={toggleSampleGrid}>
          Grid
        </Button>
        <Button size="sm" variant={showArcs ? "default" : "outline"} onClick={toggleArcs}>
          Arcs
        </Button>
      </div>
      <div className="ml-auto flex gap-2" data-tour="training-tour-approve">
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

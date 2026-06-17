"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { CatalogItemData } from "@/lib/domain/types";
import { useTrainingStore } from "@/lib/stores/training-store";
import { approveTrainingExample, exportTrainingExamplesJsonl } from "@/lib/actions/training";
import { TrainingToolbar } from "./TrainingToolbar";
import { HeadEditorPanel } from "./HeadEditorPanel";
import { ScoreComparisonPanel } from "./ScoreComparisonPanel";
import { ExampleListDrawer } from "./ExampleListDrawer";
import { TrainingTour, TrainingTourHelpButton } from "./tour/TrainingTour";
import type { TourStatus } from "@/lib/actions/tour";

const TrainingCanvas = dynamic(
  () => import("./TrainingCanvas").then((m) => m.TrainingCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading canvas…
      </div>
    ),
  }
);

type Props = {
  catalog: CatalogItemData[];
  tourStatus: TourStatus;
};

export function TrainingWorkspace({ catalog, tourStatus }: Props) {
  const generateExample = useTrainingStore((s) => s.generateExample);
  const buildApprovalPayload = useTrainingStore((s) => s.buildApprovalPayload);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const store = useTrainingStore.getState();
    store.initCatalog(catalog);
    try {
      store.generateExample();
    } catch (e) {
      console.error("Failed to generate training example", e);
      toast.error(e instanceof Error ? e.message : "Failed to generate example");
    }
  }, [catalog]);

  async function handleApprove() {
    const payload = buildApprovalPayload();
    if (!payload) {
      toast.error("Nothing to save");
      return;
    }
    setApproving(true);
    try {
      const { id } = await approveTrainingExample(payload);
      toast.success(`Saved training example ${id.slice(0, 8)}…`);
      generateExample();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setApproving(false);
    }
  }

  async function handleExport() {
    try {
      const jsonl = await exportTrainingExamplesJsonl({ status: "APPROVED" });
      const blob = new Blob([jsonl], { type: "application/x-ndjson" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `training-examples-${Date.now()}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      <TrainingTour initialStatus={tourStatus} />
      <div className="border-b px-4 py-3" data-tour="training-tour-header">
        <div className="flex items-start gap-3">
          <TrainingTourHelpButton />
          <div>
            <h1 className="text-lg font-semibold">AI Training — Head Placement</h1>
            <p className="text-sm text-muted-foreground">
              Generate synthetic lawns, correct algorithm output, and save labeled examples for future ML training.
            </p>
          </div>
        </div>
      </div>
      <TrainingToolbar onApprove={handleApprove} onExport={handleExport} approving={approving} />
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1" data-tour="training-tour-canvas">
          <TrainingCanvas />
        </div>
        <aside className="flex w-80 shrink-0 flex-col border-l bg-card">
          <div data-tour="training-tour-head-editor">
            <HeadEditorPanel />
          </div>
          <div data-tour="training-tour-scores">
            <ScoreComparisonPanel />
          </div>
          <ExampleListDrawer />
        </aside>
      </div>
    </div>
  );
}

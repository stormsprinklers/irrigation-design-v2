"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CatalogItemData } from "@/lib/domain/types";
import { useTrainingStore } from "@/lib/stores/training-store";
import { approveTrainingExample, exportTrainingExamplesJsonl } from "@/lib/actions/training";
import { TrainingToolbar } from "./TrainingToolbar";
import { TrainingCanvas } from "./TrainingCanvas";
import { HeadEditorPanel } from "./HeadEditorPanel";
import { ScoreComparisonPanel } from "./ScoreComparisonPanel";
import { ExampleListDrawer } from "./ExampleListDrawer";

type Props = {
  catalog: CatalogItemData[];
};

export function TrainingWorkspace({ catalog }: Props) {
  const generateExample = useTrainingStore((s) => s.generateExample);
  const buildApprovalPayload = useTrainingStore((s) => s.buildApprovalPayload);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const store = useTrainingStore.getState();
    store.initCatalog(catalog);
    store.generateExample();
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
      <div className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">AI Training — Head Placement</h1>
        <p className="text-sm text-muted-foreground">
          Generate synthetic lawns, correct algorithm output, and save labeled examples for future ML training.
        </p>
      </div>
      <TrainingToolbar onApprove={handleApprove} onExport={handleExport} approving={approving} />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <TrainingCanvas />
        </div>
        <aside className="flex w-80 shrink-0 flex-col border-l bg-card">
          <HeadEditorPanel />
          <ScoreComparisonPanel />
          <ExampleListDrawer />
        </aside>
      </div>
    </div>
  );
}

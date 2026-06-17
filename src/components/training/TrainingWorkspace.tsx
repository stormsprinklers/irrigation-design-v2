"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { CatalogItemData } from "@/lib/domain/types";
import { useTrainingStore } from "@/lib/stores/training-store";
import {
  approveTrainingExample,
  exportTrainingExamplesJsonl,
  getTrainingExampleStats,
} from "@/lib/actions/training";
import type { TrainingExampleStats } from "@/lib/domain/training/types";
import { TrainingToolbar } from "./TrainingToolbar";
import { HeadEditorPanel } from "./HeadEditorPanel";
import { ScoreComparisonPanel } from "./ScoreComparisonPanel";
import { TrainingStatsPanel } from "./TrainingStatsPanel";
import { ExampleListDrawer } from "./ExampleListDrawer";
import { TrainingTour, TrainingTourHelpButton } from "./tour/TrainingTour";
import type { TourStatus } from "@/lib/actions/tour";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil, BarChart3, Archive } from "lucide-react";

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

type MobileTab = "edit" | "scores" | "saved";

type Props = {
  catalog: CatalogItemData[];
  tourStatus: TourStatus;
  stats: TrainingExampleStats;
};

export function TrainingWorkspace({ catalog, tourStatus, stats: initialStats }: Props) {
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  const generateExample = useTrainingStore((s) => s.generateExample);
  const buildApprovalPayload = useTrainingStore((s) => s.buildApprovalPayload);
  const [approving, setApproving] = useState(false);
  const [stats, setStats] = useState(initialStats);

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
      setStats(await getTrainingExampleStats());
      generateExample();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setApproving(false);
    }
  }

  async function handleExport() {
    try {
      const jsonl = await exportTrainingExamplesJsonl({
        status: "APPROVED",
        validForTrainingOnly: true,
      });
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

  const sidePanel = (
    <>
      <div data-tour="training-tour-head-editor">
        <HeadEditorPanel />
      </div>
      <div data-tour="training-tour-scores">
        <ScoreComparisonPanel />
      </div>
      <TrainingStatsPanel stats={stats} />
      <ExampleListDrawer />
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TrainingTour initialStatus={tourStatus} />
      <div className="safe-top shrink-0 border-b px-3 py-3 sm:px-4" data-tour="training-tour-header">
        <div className="flex items-start gap-3">
          <TrainingTourHelpButton />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">AI Training — Head Placement</h1>
            <p className="text-sm text-muted-foreground">
              Generate synthetic lawns, correct algorithm output, and save labeled examples for
              future ML training.
            </p>
          </div>
        </div>
      </div>
      <TrainingToolbar
        onApprove={handleApprove}
        onExport={handleExport}
        approving={approving}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1" data-tour="training-tour-canvas">
          <TrainingCanvas />
        </div>
        <aside className="hidden w-80 shrink-0 flex-col border-l bg-card lg:flex">
          {sidePanel}
        </aside>
      </div>

      <div className="relative z-10 shrink-0 border-t bg-card lg:hidden">
        <div className="safe-bottom flex">
            {(
              [
                { id: "edit" as const, label: "Edit", icon: Pencil },
                { id: "scores" as const, label: "Scores", icon: BarChart3 },
                { id: "saved" as const, label: "Saved", icon: Archive },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="ghost"
                className={cn(
                  "h-11 flex-1 flex-col gap-0.5 rounded-none py-1 text-[10px]",
                  mobileTab === id && "bg-accent"
                )}
                onClick={() => setMobileTab(id)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
        </div>

        <Sheet open={mobileTab === "edit"} onOpenChange={(open) => !open && setMobileTab(null)}>
            <SheetContent side="bottom" className="max-h-[85dvh] p-0">
              <SheetHeader className="border-b">
                <SheetTitle>Head editor</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto">
                <div data-tour="training-tour-head-editor">
                  <HeadEditorPanel />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={mobileTab === "scores"} onOpenChange={(open) => !open && setMobileTab(null)}>
            <SheetContent side="bottom" className="max-h-[85dvh] p-0">
              <SheetHeader className="border-b">
                <SheetTitle>Uniformity scores</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto">
                <ScoreComparisonPanel />
                <TrainingStatsPanel stats={stats} />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={mobileTab === "saved"} onOpenChange={(open) => !open && setMobileTab(null)}>
            <SheetContent side="bottom" className="max-h-[85dvh] p-0">
              <SheetHeader className="border-b">
                <SheetTitle>Saved examples</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto">
                <ExampleListDrawer />
              </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

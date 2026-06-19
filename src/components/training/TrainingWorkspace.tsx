"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { CatalogItemData } from "@/lib/domain/types";
import { useTrainingStore, type BuiltTrainingExample } from "@/lib/stores/training-store";
import {
  approveTrainingExample,
  exportTrainingExamplesJsonl,
  getTrainingExampleStats,
} from "@/lib/actions/training";
import { refinePlacementWithMl } from "@/lib/actions/placement-ml";
import type { PlacementMlStatus } from "@/lib/actions/placement-ml";
import { formatElapsedSeconds } from "@/lib/domain/training/training-timer";
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
  mlStatus: PlacementMlStatus;
};

export function TrainingWorkspace({
  catalog,
  tourStatus,
  stats: initialStats,
  mlStatus,
}: Props) {
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  const [approving, setApproving] = useState(false);
  const [stats, setStats] = useState(initialStats);
  const initialGenerateDone = useRef(false);

  const mlAvailable =
    mlStatus.serviceHealthy && mlStatus.modelLoaded;

  async function generateWithOptionalMl(seed?: number, opts?: { forceMl?: boolean }) {
    const store = useTrainingStore.getState();
    store.beginGeneratingExample();
    let built: BuiltTrainingExample | null = null;
    try {
      built = store.buildTrainingExample(seed);
      const useMl = opts?.forceMl ?? (store.mlRefinementEnabled && mlAvailable);

      if (!useMl) {
        store.commitTrainingExample(built);
        return;
      }

      const refined = await refinePlacementWithMl({
        polygonVerticesFt: built.polygon.verticesFt,
        shapeClass: built.polygon.metadata.shapeClass,
        baselineHeads: built.baselineHeads,
        placementContext: built.placementContext,
        catalog,
        forceMl: true,
        source: "training",
      });

      const correctedHeads = refined.usedMl ? refined.heads : built.correctedHeads;
      store.commitTrainingExample(built, correctedHeads);

      if (refined.usedMl) {
        toast.success("ML refinement applied as starting layout");
      } else if (refined.error) {
        toast.message("Using heuristic layout", { description: refined.error });
      }
    } catch (e) {
      if (built) {
        store.commitTrainingExample(built);
        toast.message("Using heuristic layout", {
          description: e instanceof Error ? e.message : "ML refine failed",
        });
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to generate example");
      }
    } finally {
      useTrainingStore.getState().endGeneratingExample();
    }
  }

  useEffect(() => {
    const store = useTrainingStore.getState();
    store.initCatalog(catalog);
    store.setShapeCounts(initialStats.byShape);
    store.initSpeedBests();
    if (mlStatus.enabled && mlAvailable) {
      store.setMlRefinementEnabled(true);
    }
  }, [catalog, initialStats.byShape, mlStatus.enabled, mlAvailable]);

  useEffect(() => {
    if (initialGenerateDone.current || catalog.length === 0) return;
    initialGenerateDone.current = true;
    void generateWithOptionalMl(undefined, {
      forceMl: mlStatus.enabled && mlAvailable,
    });
  }, [catalog.length, mlAvailable, mlStatus.enabled]);

  const mlRefinementEnabled = useTrainingStore((s) => s.mlRefinementEnabled);
  const setMlRefinementEnabled = useTrainingStore((s) => s.setMlRefinementEnabled);
  const buildApprovalPayload = useTrainingStore((s) => s.buildApprovalPayload);

  useEffect(() => {
    useTrainingStore.getState().setShapeCounts(stats.byShape);
  }, [stats.byShape]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      const store = useTrainingStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "c") {
        if (store.viewMode === "baseline" || store.selectedHeadIds.length === 0) return;
        e.preventDefault();
        store.copySelectedHeads();
        return;
      }

      if (mod && e.key.toLowerCase() === "v") {
        if (store.viewMode === "baseline" || !store.copiedHeads?.length) return;
        e.preventDefault();
        store.pasteCopiedHeads();
        return;
      }

      if (mod && e.key.toLowerCase() === "d") {
        if (store.viewMode === "baseline" || store.selectedHeadIds.length === 0) return;
        e.preventDefault();
        store.duplicateSelectedHeads();
        return;
      }

      if (store.viewMode !== "baseline" && store.selectedHeadIds.length > 0) {
        if (e.shiftKey && (e.key === "?" || e.code === "Slash")) {
          if (store.selectedHeadIds.length === 1) {
            e.preventDefault();
            store.duplicateSelectedHeadAlongEdge();
          }
          return;
        }

        const key = e.key.toLowerCase();
        if (key === "m") {
          e.preventDefault();
          store.setSelectedArcDegrees(90);
          return;
        }
        if (key === "n") {
          e.preventDefault();
          store.setSelectedArcDegrees(180);
          return;
        }
        if (key === "b") {
          e.preventDefault();
          store.setSelectedArcDegrees(270);
          return;
        }
        if (key === "v") {
          e.preventDefault();
          store.setSelectedArcDegrees(360);
          return;
        }
        if (key === "+" || key === "=") {
          e.preventDefault();
          store.adjustSelectedRadius(1);
          return;
        }
        if (key === "-" || key === "_") {
          e.preventDefault();
          store.adjustSelectedRadius(-1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          store.rotateSelectedHeads(90);
          return;
        }
        if (e.key === "." || e.code === "Period") {
          e.preventDefault();
          store.snapSelectedArcsToPolygonEdges();
          return;
        }
        if (key === "s") {
          e.preventDefault();
          store.applyProsMp2000Preset();
          return;
        }
        if (key === "r") {
          e.preventDefault();
          store.applyPgpAdj15Preset();
          return;
        }
      }

      if (
        e.key === "Delete" ||
        e.key === "Backspace" ||
        e.key === " " ||
        e.code === "Space"
      ) {
        const { selectedHeadIds, viewMode, deleteSelectedHeads } = store;
        if (viewMode === "baseline" || selectedHeadIds.length === 0) return;

        e.preventDefault();
        deleteSelectedHeads();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleApprove() {
    const payload = buildApprovalPayload();
    if (!payload) {
      toast.error("Nothing to save");
      return;
    }
    setApproving(true);
    try {
      const speedResult = useTrainingStore.getState().recordExampleSpeedBest();
      await approveTrainingExample(payload);
      if (speedResult) {
        const { elapsedSec, shapeBest, overallBest } = speedResult;
        const timeLabel = formatElapsedSeconds(elapsedSec);
        if (shapeBest || overallBest) {
          const parts: string[] = [];
          if (shapeBest) parts.push("shape");
          if (overallBest) parts.push("overall");
          toast.success(`New ${parts.join(" & ")} best — ${timeLabel}`);
        } else {
          toast.success(`Example saved in ${timeLabel}`);
        }
      } else {
        toast.success("Example saved");
      }
      setStats(await getTrainingExampleStats());
      await generateWithOptionalMl();
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
    <div className="flex h-full min-h-0 flex-col">
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
        totalCompleted={stats.total}
        mlRefinementEnabled={mlRefinementEnabled}
        mlAvailable={mlAvailable}
        onMlRefinementChange={setMlRefinementEnabled}
        onGenerate={() => void generateWithOptionalMl()}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="h-full min-h-0 min-w-0 flex-1 overflow-hidden" data-tour="training-tour-canvas">
          <TrainingCanvas />
        </div>
        <aside className="hidden w-80 min-h-0 shrink-0 flex-col overflow-y-auto border-l bg-card lg:flex">
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

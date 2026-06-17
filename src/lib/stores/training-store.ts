"use client";

import { create } from "zustand";
import type { CatalogItemData } from "@/lib/domain/types";
import { generateTrainingPolygon } from "@/lib/domain/training/polygon-generator";
import { runPlacementOnPolygon } from "@/lib/domain/training/placement-adapter";
import { evaluateDesign, computeImprovementScore } from "@/lib/domain/simulation/scoring";
import { computeEditDiff } from "@/lib/domain/training/edit-diff";
import type {
  GeneratedTrainingPolygon,
  PrecipGrid,
  TrainingHeadSnapshot,
  TrainingPlacementContext,
  TrainingShapeClass,
  UniformityScores,
} from "@/lib/domain/training/types";

export type TrainingViewMode = "baseline" | "corrected" | "compare";
export type TrainingTool = "select" | "add" | "pan";

type TrainingState = {
  catalog: CatalogItemData[];
  polygon: GeneratedTrainingPolygon | null;
  baselineHeads: TrainingHeadSnapshot[];
  correctedHeads: TrainingHeadSnapshot[];
  placementContext: TrainingPlacementContext | null;
  baselineScores: UniformityScores | null;
  correctedScores: UniformityScores | null;
  baselineGrid: PrecipGrid | null;
  correctedGrid: PrecipGrid | null;
  improvementScore: number;
  selectedHeadId: string | null;
  viewMode: TrainingViewMode;
  tool: TrainingTool;
  showHeatmap: boolean;
  showSampleGrid: boolean;
  showArcs: boolean;
  shapeFilter: TrainingShapeClass | "random";

  initCatalog: (catalog: CatalogItemData[]) => void;
  generateExample: (seed?: number) => void;
  setSelectedHeadId: (id: string | null) => void;
  setViewMode: (mode: TrainingViewMode) => void;
  setTool: (tool: TrainingTool) => void;
  toggleHeatmap: () => void;
  toggleSampleGrid: () => void;
  toggleArcs: () => void;
  setShapeFilter: (shape: TrainingShapeClass | "random") => void;
  updateCorrectedHead: (id: string, patch: Partial<TrainingHeadSnapshot>) => void;
  moveCorrectedHead: (id: string, positionFt: { x: number; y: number }) => void;
  addCorrectedHead: (head: TrainingHeadSnapshot) => void;
  deleteCorrectedHead: (id: string) => void;
  resetToBaseline: () => void;
  recomputeScores: () => void;
  buildApprovalPayload: () => import("@/lib/domain/training/types").TrainingExampleApprovalInput | null;
};

function cloneHeads(heads: TrainingHeadSnapshot[]): TrainingHeadSnapshot[] {
  return heads.map((h) => ({ ...h, positionFt: { ...h.positionFt } }));
}

function recompute(
  polygon: GeneratedTrainingPolygon,
  baseline: TrainingHeadSnapshot[],
  corrected: TrainingHeadSnapshot[]
) {
  const baselineEval = evaluateDesign(polygon.verticesFt, baseline);
  const correctedEval = evaluateDesign(polygon.verticesFt, corrected);
  return {
    baselineScores: baselineEval.scores,
    correctedScores: correctedEval.scores,
    baselineGrid: baselineEval.grid,
    correctedGrid: correctedEval.grid,
    improvementScore: computeImprovementScore(baselineEval.scores, correctedEval.scores),
  };
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  catalog: [],
  polygon: null,
  baselineHeads: [],
  correctedHeads: [],
  placementContext: null,
  baselineScores: null,
  correctedScores: null,
  baselineGrid: null,
  correctedGrid: null,
  improvementScore: 0,
  selectedHeadId: null,
  viewMode: "corrected",
  tool: "select",
  showHeatmap: true,
  showSampleGrid: false,
  showArcs: true,
  shapeFilter: "random",

  initCatalog: (catalog) => set({ catalog }),

  generateExample: (seed) => {
    const { catalog, shapeFilter } = get();
    const poly = generateTrainingPolygon({
      seed,
      shapeClass: shapeFilter === "random" ? undefined : shapeFilter,
    });
    const placed = runPlacementOnPolygon(poly, catalog);
    const baseline = cloneHeads(placed.heads);
    const corrected = cloneHeads(placed.heads);
    const scores = recompute(poly, baseline, corrected);
    set({
      polygon: poly,
      baselineHeads: baseline,
      correctedHeads: corrected,
      placementContext: placed.placementContext,
      selectedHeadId: null,
      viewMode: "corrected",
      ...scores,
    });
  },

  setSelectedHeadId: (id) => set({ selectedHeadId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setTool: (tool) => set({ tool }),
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  toggleSampleGrid: () => set((s) => ({ showSampleGrid: !s.showSampleGrid })),
  toggleArcs: () => set((s) => ({ showArcs: !s.showArcs })),
  setShapeFilter: (shape) => set({ shapeFilter: shape }),

  updateCorrectedHead: (id, patch) => {
    const { polygon, baselineHeads, correctedHeads } = get();
    if (!polygon) return;
    const corrected = correctedHeads.map((h) => (h.id === id ? { ...h, ...patch } : h));
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, ...scores });
  },

  moveCorrectedHead: (id, positionFt) => {
    get().updateCorrectedHead(id, { positionFt });
  },

  addCorrectedHead: (head) => {
    const { polygon, baselineHeads, correctedHeads } = get();
    if (!polygon) return;
    const corrected = [...correctedHeads, head];
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, selectedHeadId: head.id, ...scores });
  },

  deleteCorrectedHead: (id) => {
    const { polygon, baselineHeads, correctedHeads, selectedHeadId } = get();
    if (!polygon) return;
    const corrected = correctedHeads.filter((h) => h.id !== id);
    const scores = recompute(polygon, baselineHeads, corrected);
    set({
      correctedHeads: corrected,
      selectedHeadId: selectedHeadId === id ? null : selectedHeadId,
      ...scores,
    });
  },

  resetToBaseline: () => {
    const { polygon, baselineHeads } = get();
    if (!polygon) return;
    const corrected = cloneHeads(baselineHeads);
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, selectedHeadId: null, ...scores });
  },

  recomputeScores: () => {
    const { polygon, baselineHeads, correctedHeads } = get();
    if (!polygon) return;
    const scores = recompute(polygon, baselineHeads, correctedHeads);
    set(scores);
  },

  buildApprovalPayload: () => {
    const {
      polygon,
      baselineHeads,
      correctedHeads,
      placementContext,
      baselineScores,
      correctedScores,
      baselineGrid,
      correctedGrid,
      improvementScore,
    } = get();
    if (
      !polygon ||
      !placementContext ||
      !baselineScores ||
      !correctedScores ||
      !baselineGrid ||
      !correctedGrid
    ) {
      return null;
    }
    const editLog = computeEditDiff(baselineHeads, correctedHeads);
    return {
      polygonVerticesFt: polygon.verticesFt,
      polygonMetadata: polygon.metadata,
      exclusionZonesFt: polygon.exclusionZonesFt,
      placementContext,
      algorithmOutput: baselineHeads,
      approvedOutput: correctedHeads,
      originalScores: baselineScores,
      approvedScores: correctedScores,
      originalPrecipGrid: baselineGrid,
      approvedPrecipGrid: correctedGrid,
      editLog,
      improvementScore,
    };
  },
}));

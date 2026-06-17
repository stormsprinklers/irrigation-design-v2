"use client";

import { create } from "zustand";
import type { CatalogItemData } from "@/lib/domain/types";
import { generateTrainingPolygon } from "@/lib/domain/training/polygon-generator";
import { runPlacementOnPolygon } from "@/lib/domain/training/placement-adapter";
import { evaluateDesign, computeImprovementScore } from "@/lib/domain/simulation/scoring";
import { computeEditDiff } from "@/lib/domain/training/edit-diff";
import { generateId } from "@/lib/utils";
import { stripFieldsFromNozzle } from "@/lib/catalog/strip-pattern";
import {
  patchHeadWithNozzle,
  wedgeBoundsForHead,
} from "@/lib/catalog/adjustability";
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
  updateCorrectedHead: (
    id: string,
    patch: Partial<TrainingHeadSnapshot>,
    opts?: { deferScores?: boolean }
  ) => void;
  moveCorrectedHead: (
    id: string,
    positionFt: { x: number; y: number },
    opts?: { deferScores?: boolean }
  ) => void;
  addCorrectedHead: (head: TrainingHeadSnapshot) => void;
  duplicateCorrectedHead: (id: string) => void;
  deleteCorrectedHead: (id: string) => void;
  clearCorrectedHeads: () => void;
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

function applyHeadPatch(
  head: TrainingHeadSnapshot,
  patch: Partial<TrainingHeadSnapshot>,
  catalog: CatalogItemData[]
): TrainingHeadSnapshot {
  const nozzleId = patch.catalogItemId ?? head.catalogItemId;
  const nozzle = catalog.find((c) => c.id === nozzleId);
  let base = { ...head, ...patch };

  if (patch.catalogItemId && nozzle) {
    base = { ...base, ...stripFieldsFromNozzle(nozzle) };
  }

  const hydNozzle = catalog.find((c) => c.id === base.catalogItemId);
  if (
    hydNozzle &&
    (patch.arcDegrees !== undefined ||
      patch.rotationDegrees !== undefined ||
      patch.radiusFeet !== undefined ||
      patch.catalogItemId !== undefined)
  ) {
    const hyd = patchHeadWithNozzle(base, patch, hydNozzle, 65);
    const wedges = wedgeBoundsForHead({ ...base, ...hyd, positionFt: base.positionFt });
    return { ...base, ...hyd, ...wedges };
  }
  if (patch.rotationDegrees !== undefined || patch.arcDegrees !== undefined) {
    const wedges = wedgeBoundsForHead({ ...base, positionFt: base.positionFt });
    return { ...base, ...wedges };
  }
  return base;
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
    if (catalog.length === 0) {
      throw new Error("Catalog is empty — run db:seed or add catalog items.");
    }
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

  updateCorrectedHead: (id, patch, opts) => {
    const { polygon, baselineHeads, correctedHeads, catalog } = get();
    if (!polygon) return;
    const corrected = correctedHeads.map((h) =>
      h.id === id ? applyHeadPatch(h, patch, catalog) : h
    );
    if (opts?.deferScores) {
      set({ correctedHeads: corrected });
      return;
    }
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, ...scores });
  },

  moveCorrectedHead: (id, positionFt, opts) => {
    get().updateCorrectedHead(id, { positionFt }, opts);
  },

  addCorrectedHead: (head) => {
    const { polygon, baselineHeads, correctedHeads } = get();
    if (!polygon) return;
    const corrected = [...correctedHeads, head];
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, selectedHeadId: head.id, ...scores });
  },

  duplicateCorrectedHead: (id) => {
    const { polygon, baselineHeads, correctedHeads } = get();
    if (!polygon) return;
    const source = correctedHeads.find((h) => h.id === id);
    if (!source) return;

    const duplicate: TrainingHeadSnapshot = {
      ...source,
      id: generateId("head"),
      positionFt: {
        x: source.positionFt.x + 2,
        y: source.positionFt.y + 2,
      },
    };
    const wedges = wedgeBoundsForHead(duplicate);
    const withWedges = { ...duplicate, ...wedges };

    const corrected = [...correctedHeads, withWedges];
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, selectedHeadId: withWedges.id, ...scores });
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

  clearCorrectedHeads: () => {
    const { polygon, baselineHeads } = get();
    if (!polygon) return;
    const corrected: TrainingHeadSnapshot[] = [];
    const scores = recompute(polygon, baselineHeads, corrected);
    set({
      correctedHeads: corrected,
      selectedHeadId: null,
      viewMode: "corrected",
      ...scores,
    });
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

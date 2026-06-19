"use client";

import { create } from "zustand";
import type { CatalogItemData } from "@/lib/domain/types";
import { generateTrainingPolygon } from "@/lib/domain/training/polygon-generator";
import { runPlacementOnPolygon } from "@/lib/domain/training/placement-adapter";
import { evaluateDesign, computeImprovementScore } from "@/lib/domain/simulation/scoring";
import { CURRENT_DISTRIBUTION_CURVE_VERSION } from "@/lib/domain/simulation/radial-curve";
import { computeEditDiff } from "@/lib/domain/training/edit-diff";
import { generateId } from "@/lib/utils";
import { stripFieldsFromNozzle } from "@/lib/catalog/strip-pattern";
import {
  patchHeadWithNozzle,
  swapHeadNozzle,
  wedgeBoundsForHead,
  getNozzleAdjustability,
} from "@/lib/catalog/adjustability";
import { snapHeadPositionToPolygon, snapHeadRotationToPolygon } from "@/lib/domain/training/arc-edge-snap";
import type {
  GeneratedTrainingPolygon,
  PrecipGrid,
  TrainingHeadSnapshot,
  TrainingPlacementContext,
  TrainingShapeClass,
  UniformityScores,
} from "@/lib/domain/training/types";
import {
  emptyShapeCounts,
  pickWeightedUnderrepresentedShape,
} from "@/lib/domain/training/shape-selection";

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
  selectedHeadIds: string[];
  viewMode: TrainingViewMode;
  tool: TrainingTool;
  showHeatmap: boolean;
  showSampleGrid: boolean;
  showArcs: boolean;
  shapeFilter: TrainingShapeClass | "random";
  shapeCounts: Record<TrainingShapeClass, number>;
  copiedHeads: TrainingHeadSnapshot[] | null;
  pasteGeneration: number;
  mlRefinementEnabled: boolean;
  snapArcToPolygonEdges: boolean;

  initCatalog: (catalog: CatalogItemData[]) => void;
  setMlRefinementEnabled: (enabled: boolean) => void;
  toggleSnapArcToPolygonEdges: () => void;
  setShapeCounts: (counts: Record<TrainingShapeClass, number>) => void;
  generateExample: (seed?: number) => void;
  /** Apply ML-refined layout as starting corrected heads (baseline stays heuristic). */
  applyMlStartingLayout: (heads: TrainingHeadSnapshot[]) => void;
  selectHead: (id: string, opts?: { additive?: boolean }) => void;
  setSelectedHeadIds: (ids: string[]) => void;
  clearSelection: () => void;
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
  duplicateSelectedHeads: () => void;
  patchSelectedHeads: (
    patch: Partial<TrainingHeadSnapshot>,
    opts?: { deferScores?: boolean }
  ) => void;
  setSelectedArcDegrees: (arcDegrees: number) => void;
  rotateSelectedHeads: (deltaDeg: number) => void;
  adjustSelectedRadius: (deltaFt: number, opts?: { deferScores?: boolean }) => void;
  moveSelectedHeadsByDelta: (
    dxFt: number,
    dyFt: number,
    opts?: { deferScores?: boolean }
  ) => void;
  moveHeadsToPositions: (
    positions: Record<string, { x: number; y: number }>,
    opts?: { deferScores?: boolean }
  ) => void;
  deleteCorrectedHeads: (ids: string[]) => void;
  deleteSelectedHeads: () => void;
  copySelectedHeads: () => void;
  pasteCopiedHeads: () => void;
  clearCorrectedHeads: () => void;
  recomputeScores: () => void;
  buildApprovalPayload: () => import("@/lib/domain/training/types").TrainingExampleApprovalInput | null;
};

function cloneHeads(heads: TrainingHeadSnapshot[]): TrainingHeadSnapshot[] {
  return heads.map((h) => ({ ...h, positionFt: { ...h.positionFt } }));
}

const PASTE_OFFSET_FT = 2;

function cloneHeadWithOffset(
  source: TrainingHeadSnapshot,
  offsetFt: number
): TrainingHeadSnapshot {
  const head: TrainingHeadSnapshot = {
    ...source,
    id: generateId("head"),
    positionFt: {
      x: source.positionFt.x + offsetFt,
      y: source.positionFt.y + offsetFt,
    },
  };
  return { ...head, ...wedgeBoundsForHead(head) };
}

function recompute(
  polygon: GeneratedTrainingPolygon,
  baseline: TrainingHeadSnapshot[],
  corrected: TrainingHeadSnapshot[]
) {
  const evalOpts = {
    exclusionZones: polygon.exclusionZonesFt,
    distributionCurveVersion: CURRENT_DISTRIBUTION_CURVE_VERSION,
  };
  const baselineEval = evaluateDesign(polygon.verticesFt, baseline, 1.5, evalOpts);
  const correctedEval = evaluateDesign(polygon.verticesFt, corrected, 1.5, evalOpts);
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
  const geometryTouched =
    patch.arcDegrees !== undefined ||
    patch.rotationDegrees !== undefined ||
    patch.radiusFeet !== undefined;

  if (hydNozzle && patch.catalogItemId !== undefined && !geometryTouched) {
    const hyd = swapHeadNozzle(base, hydNozzle, 65);
    const wedges = wedgeBoundsForHead({ ...base, positionFt: base.positionFt });
    return { ...base, ...hyd, ...wedges };
  }

  if (hydNozzle && (geometryTouched || patch.catalogItemId !== undefined)) {
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

function applyPatchWithOptionalSnap(
  head: TrainingHeadSnapshot,
  patch: Partial<TrainingHeadSnapshot>,
  catalog: CatalogItemData[],
  polygon: GeneratedTrainingPolygon | null,
  snapToPolygon: boolean
): TrainingHeadSnapshot {
  let nextPatch = patch;
  if (snapToPolygon && polygon) {
    if (
      patch.rotationDegrees !== undefined &&
      patch.rotationDegrees !== head.rotationDegrees
    ) {
      const candidate = { ...head, ...nextPatch };
      const snapped = snapHeadRotationToPolygon(candidate, polygon.verticesFt);
      if (snapped != null) {
        nextPatch = { ...nextPatch, rotationDegrees: snapped };
      }
    }
    if (patch.positionFt !== undefined) {
      const candidatePos = patch.positionFt;
      const snappedPos = snapHeadPositionToPolygon(candidatePos, polygon.verticesFt);
      if (snappedPos.x !== candidatePos.x || snappedPos.y !== candidatePos.y) {
        nextPatch = { ...nextPatch, positionFt: snappedPos };
      }
    }
  }
  return applyHeadPatch(head, nextPatch, catalog);
}

function snapPositionsIfEnabled(
  positions: Record<string, { x: number; y: number }>,
  polygon: GeneratedTrainingPolygon | null,
  snapToPolygon: boolean
): Record<string, { x: number; y: number }> {
  if (!snapToPolygon || !polygon) return positions;
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, pos] of Object.entries(positions)) {
    out[id] = snapHeadPositionToPolygon(pos, polygon.verticesFt);
  }
  return out;
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
  selectedHeadIds: [],
  viewMode: "corrected",
  tool: "select",
  showHeatmap: true,
  showSampleGrid: false,
  showArcs: true,
  shapeFilter: "random",
  shapeCounts: emptyShapeCounts(),
  copiedHeads: null,
  pasteGeneration: 0,
  mlRefinementEnabled: false,
  snapArcToPolygonEdges: false,

  initCatalog: (catalog) => set({ catalog }),
  setMlRefinementEnabled: (enabled) => set({ mlRefinementEnabled: enabled }),
  toggleSnapArcToPolygonEdges: () =>
    set((s) => ({ snapArcToPolygonEdges: !s.snapArcToPolygonEdges })),
  setShapeCounts: (counts) => set({ shapeCounts: counts }),

  generateExample: (seed) => {
    const { catalog, shapeFilter, shapeCounts } = get();
    if (catalog.length === 0) {
      throw new Error("Catalog is empty — run db:seed or add catalog items.");
    }
    const shapeClass =
      shapeFilter === "random"
        ? pickWeightedUnderrepresentedShape(shapeCounts)
        : shapeFilter;
    const poly = generateTrainingPolygon({
      seed,
      shapeClass,
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
      selectedHeadIds: [],
      viewMode: "corrected",
      ...scores,
    });
  },

  applyMlStartingLayout: (heads) => {
    const { polygon, baselineHeads } = get();
    if (!polygon) return;
    const corrected = cloneHeads(heads);
    const scores = recompute(polygon, baselineHeads, corrected);
    set({
      correctedHeads: corrected,
      selectedHeadIds: [],
      viewMode: "corrected",
      ...scores,
    });
  },

  selectHead: (id, opts) => {
    const { selectedHeadIds } = get();
    if (opts?.additive) {
      const next = selectedHeadIds.includes(id)
        ? selectedHeadIds.filter((x) => x !== id)
        : [...selectedHeadIds, id];
      set({ selectedHeadIds: next });
      return;
    }
    set({ selectedHeadIds: [id] });
  },

  setSelectedHeadIds: (ids) => set({ selectedHeadIds: ids }),
  clearSelection: () => set({ selectedHeadIds: [] }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setTool: (tool) => set({ tool }),
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  toggleSampleGrid: () => set((s) => ({ showSampleGrid: !s.showSampleGrid })),
  toggleArcs: () => set((s) => ({ showArcs: !s.showArcs })),
  setShapeFilter: (shape) => set({ shapeFilter: shape }),

  updateCorrectedHead: (id, patch, opts) => {
    const { polygon, baselineHeads, correctedHeads, catalog, snapArcToPolygonEdges } = get();
    if (!polygon) return;
    const corrected = correctedHeads.map((h) =>
      h.id === id
        ? applyPatchWithOptionalSnap(h, patch, catalog, polygon, snapArcToPolygonEdges)
        : h
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
    set({ correctedHeads: corrected, selectedHeadIds: [head.id], ...scores });
  },

  duplicateCorrectedHead: (id) => {
    const { polygon, baselineHeads, correctedHeads } = get();
    if (!polygon) return;
    const source = correctedHeads.find((h) => h.id === id);
    if (!source) return;
    const dupes = [cloneHeadWithOffset(source, PASTE_OFFSET_FT)];
    const corrected = [...correctedHeads, ...dupes];
    const scores = recompute(polygon, baselineHeads, corrected);
    set({
      correctedHeads: corrected,
      selectedHeadIds: dupes.map((h) => h.id),
      ...scores,
    });
  },

  duplicateSelectedHeads: () => {
    const { polygon, baselineHeads, correctedHeads, selectedHeadIds } = get();
    if (!polygon || selectedHeadIds.length === 0) return;
    const idSet = new Set(selectedHeadIds);
    const dupes = correctedHeads
      .filter((h) => idSet.has(h.id))
      .map((h) => cloneHeadWithOffset(h, PASTE_OFFSET_FT));
    if (dupes.length === 0) return;
    const corrected = [...correctedHeads, ...dupes];
    const scores = recompute(polygon, baselineHeads, corrected);
    set({
      correctedHeads: corrected,
      selectedHeadIds: dupes.map((h) => h.id),
      ...scores,
    });
  },

  patchSelectedHeads: (patch, opts) => {
    const { selectedHeadIds, polygon, baselineHeads, correctedHeads, catalog, snapArcToPolygonEdges } =
      get();
    if (!polygon || selectedHeadIds.length === 0) return;
    const idSet = new Set(selectedHeadIds);
    const corrected = correctedHeads.map((h) =>
      idSet.has(h.id)
        ? applyPatchWithOptionalSnap(h, patch, catalog, polygon, snapArcToPolygonEdges)
        : h
    );
    if (opts?.deferScores) {
      set({ correctedHeads: corrected });
      return;
    }
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, ...scores });
  },

  setSelectedArcDegrees: (arcDegrees) => {
    const { selectedHeadIds, correctedHeads, catalog } = get();
    if (selectedHeadIds.length === 0) return;
    const idSet = new Set(selectedHeadIds);
    const patches: Record<string, Partial<TrainingHeadSnapshot>> = {};
    for (const h of correctedHeads) {
      if (!idSet.has(h.id)) continue;
      const nozzle = catalog.find((c) => c.id === h.catalogItemId);
      if (!nozzle) continue;
      const adj = getNozzleAdjustability(nozzle);
      if (!adj.arcAdjustable) continue;
      const next = Math.min(adj.arcDegreesMax, Math.max(adj.arcDegreesMin, arcDegrees));
      patches[h.id] = { arcDegrees: next };
    }
    const { polygon, baselineHeads, snapArcToPolygonEdges } = get();
    if (!polygon) return;
    const corrected = correctedHeads.map((h) => {
      const patch = patches[h.id];
      if (!patch) return h;
      return applyPatchWithOptionalSnap(h, patch, catalog, polygon, snapArcToPolygonEdges);
    });
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, ...scores });
  },

  rotateSelectedHeads: (deltaDeg) => {
    const { polygon, baselineHeads, correctedHeads, selectedHeadIds, catalog, snapArcToPolygonEdges } =
      get();
    if (!polygon || selectedHeadIds.length === 0) return;
    const idSet = new Set(selectedHeadIds);
    const corrected = correctedHeads.map((h) => {
      if (!idSet.has(h.id)) return h;
      const rotationDegrees = ((h.rotationDegrees + deltaDeg) % 360 + 360) % 360;
      return applyPatchWithOptionalSnap(
        h,
        { rotationDegrees },
        catalog,
        polygon,
        snapArcToPolygonEdges
      );
    });
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, ...scores });
  },

  adjustSelectedRadius: (deltaFt, opts) => {
    const { polygon, baselineHeads, correctedHeads, selectedHeadIds, catalog } = get();
    if (!polygon || selectedHeadIds.length === 0) return;
    const idSet = new Set(selectedHeadIds);
    const corrected = correctedHeads.map((h) => {
      if (!idSet.has(h.id)) return h;
      const nozzle = catalog.find((c) => c.id === h.catalogItemId);
      if (!nozzle) return h;
      const adj = getNozzleAdjustability(nozzle);
      if (!adj.radiusAdjustable) return h;
      return applyHeadPatch(h, { radiusFeet: h.radiusFeet + deltaFt }, catalog);
    });
    if (opts?.deferScores) {
      set({ correctedHeads: corrected });
      return;
    }
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, ...scores });
  },

  moveSelectedHeadsByDelta: (dxFt, dyFt, opts) => {
    const { polygon, baselineHeads, correctedHeads, selectedHeadIds } = get();
    if (!polygon || selectedHeadIds.length === 0) return;
    const idSet = new Set(selectedHeadIds);
    const corrected = correctedHeads.map((h) =>
      idSet.has(h.id)
        ? {
            ...h,
            positionFt: { x: h.positionFt.x + dxFt, y: h.positionFt.y + dyFt },
          }
        : h
    );
    if (opts?.deferScores) {
      set({ correctedHeads: corrected });
      return;
    }
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, ...scores });
  },

  moveHeadsToPositions: (positions, opts) => {
    const { polygon, baselineHeads, correctedHeads, snapArcToPolygonEdges } = get();
    if (!polygon || Object.keys(positions).length === 0) return;
    const snapped = snapPositionsIfEnabled(positions, polygon, snapArcToPolygonEdges);
    const corrected = correctedHeads.map((h) =>
      snapped[h.id] ? { ...h, positionFt: { ...snapped[h.id]! } } : h
    );
    if (opts?.deferScores) {
      set({ correctedHeads: corrected });
      return;
    }
    const scores = recompute(polygon, baselineHeads, corrected);
    set({ correctedHeads: corrected, ...scores });
  },

  copySelectedHeads: () => {
    const { correctedHeads, selectedHeadIds } = get();
    if (selectedHeadIds.length === 0) return;
    const idSet = new Set(selectedHeadIds);
    const heads = cloneHeads(correctedHeads.filter((h) => idSet.has(h.id)));
    if (heads.length === 0) return;
    set({ copiedHeads: heads, pasteGeneration: 0 });
  },

  pasteCopiedHeads: () => {
    const { polygon, baselineHeads, correctedHeads, copiedHeads, pasteGeneration, viewMode } =
      get();
    if (!polygon || viewMode === "baseline" || !copiedHeads?.length) return;

    const generation = pasteGeneration + 1;
    const offsetFt = PASTE_OFFSET_FT * generation;
    const pasted = copiedHeads.map((source) => cloneHeadWithOffset(source, offsetFt));
    const corrected = [...correctedHeads, ...pasted];
    const scores = recompute(polygon, baselineHeads, corrected);
    set({
      correctedHeads: corrected,
      selectedHeadIds: pasted.map((h) => h.id),
      pasteGeneration: generation,
      ...scores,
    });
  },

  deleteCorrectedHeads: (ids) => {
    const { polygon, baselineHeads, correctedHeads, selectedHeadIds } = get();
    if (!polygon || ids.length === 0) return;
    const idSet = new Set(ids);
    const corrected = correctedHeads.filter((h) => !idSet.has(h.id));
    const scores = recompute(polygon, baselineHeads, corrected);
    set({
      correctedHeads: corrected,
      selectedHeadIds: selectedHeadIds.filter((id) => !idSet.has(id)),
      ...scores,
    });
  },

  deleteSelectedHeads: () => {
    const { selectedHeadIds } = get();
    get().deleteCorrectedHeads(selectedHeadIds);
  },

  clearCorrectedHeads: () => {
    const { polygon, baselineHeads } = get();
    if (!polygon) return;
    const corrected: TrainingHeadSnapshot[] = [];
    const scores = recompute(polygon, baselineHeads, corrected);
    set({
      correctedHeads: corrected,
      selectedHeadIds: [],
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
      distributionCurveVersion: CURRENT_DISTRIBUTION_CURVE_VERSION,
      validForTraining: true,
      needsRescore: false,
    };
  },
}));

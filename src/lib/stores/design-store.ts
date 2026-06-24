"use client";

import { create } from "zustand";
import type {
  CatalogItemData,
  DesignDocument,
  EquipmentType,
  ExclusionType,
  Point,
  SiteFeatureType,
  SprinklerHead,
  ValidationIssue,
} from "@/lib/domain/types";
import { normalizeDesignDocument } from "@/lib/domain/normalize";
import { EMPTY_DESIGN_DOCUMENT } from "@/lib/domain/types";
import {
  adjustHeadRadius,
  cloneHeadForClipboard,
  deleteHeadFromDocument,
  designPressurePsi,
  duplicateHeadInDocument,
  flipHead,
  moveHeadInDocument,
  patchHeadInDocument,
  pasteHeadsInDocument,
  rotateHeadDegrees,
  setHeadArcDegrees,
  sanitizeDesignHeads,
} from "@/lib/domain/design/head-editing";

export type DesignTool =
  | "select"
  | "pan"
  | "hydrozone"
  | "exclusion"
  | "siteFeature"
  | "sod"
  | "topsoil"
  | "scale"
  | "head"
  | "pipe"
  | "valve"
  | "equipment";

type HeadPreset = {
  headBodyId: string;
  catalogItemId: string;
};

type DesignState = {
  projectId: string | null;
  versionId: string | null;
  versionKind: string | null;
  document: DesignDocument;
  activeTool: DesignTool;
  activeZoneId: string | null;
  pendingSiteFeatureType: SiteFeatureType;
  pendingExclusionType: ExclusionType;
  equipmentPlacementType: EquipmentType;
  selectedId: string | null;
  selectedType:
    | "head"
    | "hydrozone"
    | "exclusion"
    | "siteFeature"
    | "landscape"
    | "pipe"
    | "valve"
    | "equipment"
    | null;
  drawingVertices: Point[];
  scalePointA: Point | null;
  scalePointB: Point | null;
  validationIssues: ValidationIssue[];
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  canvasZoom: number;
  stagePosition: Point;
  viewportSize: { width: number; height: number };
  contentSize: { width: number; height: number };
  canvasViewResetAt: number;
  headCanvasInteracting: boolean;
  copiedHeads: SprinklerHead[] | null;
  pasteGeneration: number;
  lastCanvasClick: Point | null;
  showPipes: boolean;

  init: (projectId: string, versionId: string, versionKind: string, doc: DesignDocument) => void;
  setDocument: (doc: DesignDocument) => void;
  setTool: (tool: DesignTool) => void;
  setPendingSiteFeatureType: (type: SiteFeatureType) => void;
  setPendingExclusionType: (type: ExclusionType) => void;
  setEquipmentPlacementType: (type: EquipmentType) => void;
  setActiveZoneId: (zoneId: string | null) => void;
  setSelected: (id: string | null, type: DesignState["selectedType"]) => void;
  clearSelection: () => void;
  addDrawingVertex: (point: Point) => void;
  clearDrawing: () => void;
  setScalePointA: (point: Point | null) => void;
  setScalePointB: (point: Point | null) => void;
  setValidationIssues: (issues: ValidationIssue[]) => void;
  markDirty: () => void;
  markSaved: () => void;
  setSaving: (saving: boolean) => void;
  setCanvasView: (zoom: number, position: Point) => void;
  setViewportSize: (width: number, height: number) => void;
  setContentSize: (width: number, height: number) => void;
  centerCanvasView: (zoom?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetCanvasView: () => void;
  clearCanvasDesign: () => void;
  setHeadCanvasInteracting: (interacting: boolean) => void;
  setLastCanvasClick: (point: Point | null) => void;
  editHead: (
    headId: string,
    catalog: CatalogItemData[],
    patch: Partial<SprinklerHead>,
    pressurePsi?: number
  ) => void;
  moveHeadById: (headId: string, position: Point) => void;
  patchSelectedHead: (
    catalog: CatalogItemData[],
    patch: Partial<SprinklerHead>,
    pressurePsi?: number
  ) => void;
  moveSelectedHead: (position: Point) => void;
  deleteSelectedHead: () => void;
  duplicateSelectedHead: () => void;
  copySelectedHead: () => void;
  pasteCopiedHead: () => void;
  flipSelectedHead: (catalog: CatalogItemData[], pressurePsi?: number) => void;
  rotateSelectedHead: (deltaDeg: number, catalog: CatalogItemData[], pressurePsi?: number) => void;
  setSelectedHeadArcDegrees: (
    arcDegrees: number,
    catalog: CatalogItemData[],
    pressurePsi?: number
  ) => void;
  adjustSelectedHeadRadius: (
    deltaFt: number,
    catalog: CatalogItemData[],
    pressurePsi?: number
  ) => void;
  applyHeadPreset: (preset: HeadPreset, catalog: CatalogItemData[], pressurePsi?: number) => void;
  setShowPipes: (show: boolean) => void;
};

function centeredPosition(
  viewport: { width: number; height: number },
  content: { width: number; height: number },
  zoom: number
): Point {
  return {
    x: (viewport.width - content.width * zoom) / 2,
    y: (viewport.height - content.height * zoom) / 2,
  };
}

function zoomTowardViewportCenter(
  state: DesignState,
  newZoom: number
): Pick<DesignState, "canvasZoom" | "stagePosition"> {
  const centerX = state.viewportSize.width / 2;
  const centerY = state.viewportSize.height / 2;
  const mousePointTo = {
    x: (centerX - state.stagePosition.x) / state.canvasZoom,
    y: (centerY - state.stagePosition.y) / state.canvasZoom,
  };
  return {
    canvasZoom: newZoom,
    stagePosition: {
      x: centerX - mousePointTo.x * newZoom,
      y: centerY - mousePointTo.y * newZoom,
    },
  };
}

function patchHeadForState(
  state: DesignState,
  headId: string,
  catalog: CatalogItemData[],
  patch: Partial<SprinklerHead>,
  pressurePsi?: number
): Pick<DesignState, "document" | "isDirty"> {
  const head = state.document.heads.find((h) => h.id === headId);
  if (!head || head.locked) return { document: state.document, isDirty: state.isDirty };
  return {
    document: patchHeadInDocument(state.document, headId, patch, catalog, pressurePsi),
    isDirty: true,
  };
}

export const useDesignStore = create<DesignState>((set, get) => ({
  projectId: null,
  versionId: null,
  versionKind: null,
  document: EMPTY_DESIGN_DOCUMENT,
  activeTool: "select",
  activeZoneId: null,
  pendingSiteFeatureType: "SLOPE",
  pendingExclusionType: "BUILDING",
  equipmentPlacementType: "BACKFLOW",
  selectedId: null,
  selectedType: null,
  drawingVertices: [],
  scalePointA: null,
  scalePointB: null,
  validationIssues: [],
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  canvasZoom: 1,
  stagePosition: { x: 0, y: 0 },
  viewportSize: { width: 0, height: 0 },
  contentSize: { width: 1200, height: 800 },
  canvasViewResetAt: 0,
  headCanvasInteracting: false,
  copiedHeads: null,
  pasteGeneration: 0,
  lastCanvasClick: null,
  showPipes: true,

  init: (projectId, versionId, versionKind, doc) =>
    set((s) => {
      const content = {
        width: doc.propertyImage?.width ?? 1200,
        height: doc.propertyImage?.height ?? 800,
      };
      const zoom = 1;
      return {
        projectId,
        versionId,
        versionKind,
        document: sanitizeDesignHeads(normalizeDesignDocument(doc)),
        isDirty: false,
        drawingVertices: [],
        scalePointA: null,
        scalePointB: null,
        canvasZoom: zoom,
        contentSize: content,
        canvasViewResetAt: s.canvasViewResetAt + 1,
        stagePosition:
          s.viewportSize.width > 0
            ? centeredPosition(s.viewportSize, content, zoom)
            : { x: 0, y: 0 },
        selectedId: null,
        selectedType: null,
        copiedHeads: null,
        pasteGeneration: 0,
      };
    }),
  setDocument: (doc) => set({ document: doc, isDirty: true }),
  setTool: (tool) =>
    set({
      activeTool: tool,
      drawingVertices: [],
      scalePointA: null,
      scalePointB: null,
    }),
  setPendingSiteFeatureType: (type) => set({ pendingSiteFeatureType: type }),
  setPendingExclusionType: (type) => set({ pendingExclusionType: type }),
  setEquipmentPlacementType: (type) => set({ equipmentPlacementType: type }),
  setActiveZoneId: (zoneId) => set({ activeZoneId: zoneId }),
  setSelected: (id, type) => set({ selectedId: id, selectedType: type }),
  clearSelection: () => set({ selectedId: null, selectedType: null }),
  addDrawingVertex: (point) =>
    set((s) => ({ drawingVertices: [...s.drawingVertices, point], isDirty: true })),
  clearDrawing: () => set({ drawingVertices: [] }),
  setScalePointA: (point) => set({ scalePointA: point }),
  setScalePointB: (point) => set({ scalePointB: point }),
  setValidationIssues: (issues) => set({ validationIssues: issues }),
  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false, isSaving: false, lastSavedAt: new Date() }),
  setSaving: (saving) => set({ isSaving: saving }),
  setCanvasView: (zoom, position) => set({ canvasZoom: zoom, stagePosition: position }),
  setViewportSize: (width, height) => set({ viewportSize: { width, height } }),
  setContentSize: (width, height) => set({ contentSize: { width, height } }),
  centerCanvasView: (zoom) =>
    set((s) => {
      const nextZoom = zoom ?? s.canvasZoom;
      if (s.viewportSize.width <= 0) return { canvasZoom: nextZoom };
      return {
        canvasZoom: nextZoom,
        stagePosition: centeredPosition(s.viewportSize, s.contentSize, nextZoom),
      };
    }),
  zoomIn: () =>
    set((s) => {
      const newZoom = Math.min(4, Math.round(s.canvasZoom * 1.2 * 100) / 100);
      return s.viewportSize.width > 0
        ? zoomTowardViewportCenter(s, newZoom)
        : { canvasZoom: newZoom };
    }),
  zoomOut: () =>
    set((s) => {
      const newZoom = Math.max(0.25, Math.round((s.canvasZoom / 1.2) * 100) / 100);
      return s.viewportSize.width > 0
        ? zoomTowardViewportCenter(s, newZoom)
        : { canvasZoom: newZoom };
    }),
  resetCanvasView: () =>
    set((s) => ({
      canvasZoom: 1,
      canvasViewResetAt: s.canvasViewResetAt + 1,
      stagePosition:
        s.viewportSize.width > 0
          ? centeredPosition(s.viewportSize, s.contentSize, 1)
          : { x: 0, y: 0 },
    })),
  clearCanvasDesign: () =>
    set((s) => ({
      document: {
        ...s.document,
        hydrozones: [],
        exclusionZones: [],
        siteFeatures: [],
        landscapeAreas: [],
        zones: [],
        heads: [],
        pipes: [],
        valves: [],
        equipment: [],
      },
      selectedId: null,
      selectedType: null,
      activeZoneId: null,
      drawingVertices: [],
      scalePointA: null,
      scalePointB: null,
      validationIssues: [],
      isDirty: true,
    })),

  setHeadCanvasInteracting: (interacting) => set({ headCanvasInteracting: interacting }),
  setLastCanvasClick: (point) => set({ lastCanvasClick: point }),

  editHead: (headId, catalog, patch, pressurePsi) =>
    set((s) => {
      const updated = patchHeadForState(s, headId, catalog, patch, pressurePsi);
      if (!updated.isDirty) return s;
      return {
        ...updated,
        selectedId: headId,
        selectedType: "head" as const,
      };
    }),

  moveHeadById: (headId, position) =>
    set((s) => {
      const head = s.document.heads.find((h) => h.id === headId);
      if (!head || head.locked) return s;
      return {
        document: moveHeadInDocument(s.document, headId, position),
        selectedId: headId,
        selectedType: "head" as const,
        isDirty: true,
      };
    }),

  patchSelectedHead: (catalog, patch, pressurePsi) => {
    const { selectedId } = get();
    if (!selectedId) return;
    get().editHead(selectedId, catalog, patch, pressurePsi);
  },

  moveSelectedHead: (position) => {
    const { selectedId } = get();
    if (!selectedId) return;
    get().moveHeadById(selectedId, position);
  },

  deleteSelectedHead: () =>
    set((s) => {
      if (s.selectedType !== "head" || !s.selectedId) return s;
      return {
        document: deleteHeadFromDocument(s.document, s.selectedId),
        selectedId: null,
        selectedType: null,
        isDirty: true,
      };
    }),

  duplicateSelectedHead: () =>
    set((s) => {
      if (s.selectedType !== "head" || !s.selectedId) return s;
      const result = duplicateHeadInDocument(s.document, s.selectedId);
      if (!result) return s;
      return {
        document: result.document,
        selectedId: result.newHeadId,
        selectedType: "head" as const,
        isDirty: true,
      };
    }),

  copySelectedHead: () =>
    set((s) => {
      if (s.selectedType !== "head" || !s.selectedId) return s;
      const head = s.document.heads.find((h) => h.id === s.selectedId);
      if (!head) return s;
      return {
        copiedHeads: [cloneHeadForClipboard(head)],
        pasteGeneration: 0,
      };
    }),

  pasteCopiedHead: () =>
    set((s) => {
      if (!s.copiedHeads?.length) return s;
      const generation = s.pasteGeneration + 1;
      const ppf =
        s.lastCanvasClick ??
        (() => {
          const source = s.document.heads.find((h) => h.id === s.selectedId);
          if (source) return source.position;
          return { x: 100, y: 100 };
        })();
      const result = pasteHeadsInDocument(s.document, s.copiedHeads, ppf, generation);
      return {
        document: result.document,
        selectedId: result.newHeadIds[0] ?? s.selectedId,
        selectedType: "head" as const,
        pasteGeneration: generation,
        isDirty: true,
      };
    }),

  flipSelectedHead: (catalog, pressurePsi) =>
    set((s) => {
      if (s.selectedType !== "head" || !s.selectedId) return s;
      const head = s.document.heads.find((h) => h.id === s.selectedId);
      if (!head || head.locked) return s;
      const pressure = pressurePsi ?? designPressurePsi(s.document);
      const next = flipHead(head, catalog, pressure);
      return {
        document: patchHeadInDocument(
          s.document,
          s.selectedId,
          { rotationDegrees: next.rotationDegrees, gpm: next.gpm, precipInPerHr: next.precipInPerHr },
          catalog,
          pressure
        ),
        isDirty: true,
      };
    }),

  rotateSelectedHead: (deltaDeg, catalog, pressurePsi) => {
    const { selectedId } = get();
    if (!selectedId) return;
    const s = get();
    const head = s.document.heads.find((h) => h.id === selectedId);
    if (!head || head.locked) return;
    const pressure = pressurePsi ?? designPressurePsi(s.document);
    const next = rotateHeadDegrees(head, deltaDeg, catalog, pressure);
    get().editHead(
      selectedId,
      catalog,
      {
        rotationDegrees: next.rotationDegrees,
        gpm: next.gpm,
        precipInPerHr: next.precipInPerHr,
      },
      pressure
    );
  },

  setSelectedHeadArcDegrees: (arcDegrees, catalog, pressurePsi) => {
    const { selectedId } = get();
    if (!selectedId) return;
    const s = get();
    const head = s.document.heads.find((h) => h.id === selectedId);
    if (!head || head.locked) return;
    const pressure = pressurePsi ?? designPressurePsi(s.document);
    const next = setHeadArcDegrees(head, arcDegrees, catalog, pressure);
    if (!next) return;
    get().editHead(
      selectedId,
      catalog,
      {
        arcDegrees: next.arcDegrees,
        radiusFeet: next.radiusFeet,
        gpm: next.gpm,
        precipInPerHr: next.precipInPerHr,
      },
      pressure
    );
  },

  adjustSelectedHeadRadius: (deltaFt, catalog, pressurePsi) => {
    const { selectedId } = get();
    if (!selectedId) return;
    const s = get();
    const head = s.document.heads.find((h) => h.id === selectedId);
    if (!head || head.locked) return;
    const pressure = pressurePsi ?? designPressurePsi(s.document);
    const next = adjustHeadRadius(head, deltaFt, catalog, pressure);
    if (!next) return;
    get().editHead(
      selectedId,
      catalog,
      {
        radiusFeet: next.radiusFeet,
        gpm: next.gpm,
        precipInPerHr: next.precipInPerHr,
      },
      pressure
    );
  },

  applyHeadPreset: (preset, catalog, pressurePsi) => {
    const { selectedId } = get();
    if (!selectedId) return;
    const nozzle = catalog.find((c) => c.id === preset.catalogItemId);
    if (!nozzle) return;
    get().editHead(
      selectedId,
      catalog,
      {
        headBodyId: preset.headBodyId,
        catalogItemId: preset.catalogItemId,
      },
      pressurePsi
    );
  },

  setShowPipes: (show) => set({ showPipes: show }),
}));

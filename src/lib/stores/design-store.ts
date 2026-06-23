"use client";

import { create } from "zustand";
import type { CatalogItemData, DesignDocument, Point, SprinklerHead, ValidationIssue } from "@/lib/domain/types";
import { EMPTY_DESIGN_DOCUMENT } from "@/lib/domain/types";
import {
  adjustHeadRadius,
  deleteHeadFromDocument,
  designPressurePsi,
  duplicateHeadInDocument,
  moveHeadInDocument,
  patchHeadInDocument,
  rotateHeadDegrees,
  setHeadArcDegrees,
} from "@/lib/domain/design/head-editing";

export type DesignTool =
  | "select"
  | "pan"
  | "hydrozone"
  | "exclusion"
  | "scale"
  | "head"
  | "pipe";

type DesignState = {
  projectId: string | null;
  versionId: string | null;
  versionKind: string | null;
  document: DesignDocument;
  activeTool: DesignTool;
  activeZoneId: string | null;
  selectedId: string | null;
  selectedType: "head" | "hydrozone" | "exclusion" | "pipe" | "valve" | null;
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

  init: (projectId: string, versionId: string, versionKind: string, doc: DesignDocument) => void;
  setDocument: (doc: DesignDocument) => void;
  setTool: (tool: DesignTool) => void;
  setActiveZoneId: (zoneId: string | null) => void;
  setSelected: (id: string | null, type: DesignState["selectedType"]) => void;
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
  patchSelectedHead: (
    catalog: CatalogItemData[],
    patch: Partial<SprinklerHead>,
    pressurePsi?: number
  ) => void;
  moveSelectedHead: (position: Point) => void;
  deleteSelectedHead: () => void;
  duplicateSelectedHead: () => void;
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

export const useDesignStore = create<DesignState>((set) => ({
  projectId: null,
  versionId: null,
  versionKind: null,
  document: EMPTY_DESIGN_DOCUMENT,
  activeTool: "select",
  activeZoneId: null,
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
        document: doc,
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
      };
    }),
  setDocument: (doc) => set({ document: doc, isDirty: true }),
  setTool: (tool) => set({ activeTool: tool, drawingVertices: [], scalePointA: null, scalePointB: null }),
  setActiveZoneId: (zoneId) => set({ activeZoneId: zoneId }),
  setSelected: (id, type) => set({ selectedId: id, selectedType: type }),
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
        zones: [],
        heads: [],
        pipes: [],
        valves: [],
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

  patchSelectedHead: (catalog, patch, pressurePsi) =>
    set((s) => {
      if (s.selectedType !== "head" || !s.selectedId) return s;
      const head = s.document.heads.find((h) => h.id === s.selectedId);
      if (!head || head.locked) return s;
      return {
        document: patchHeadInDocument(
          s.document,
          s.selectedId,
          patch,
          catalog,
          pressurePsi
        ),
        isDirty: true,
      };
    }),

  moveSelectedHead: (position) =>
    set((s) => {
      if (s.selectedType !== "head" || !s.selectedId) return s;
      const head = s.document.heads.find((h) => h.id === s.selectedId);
      if (!head || head.locked) return s;
      return {
        document: moveHeadInDocument(s.document, s.selectedId, position),
        isDirty: true,
      };
    }),

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

  rotateSelectedHead: (deltaDeg, catalog, pressurePsi) =>
    set((s) => {
      if (s.selectedType !== "head" || !s.selectedId) return s;
      const head = s.document.heads.find((h) => h.id === s.selectedId);
      if (!head || head.locked) return s;
      const pressure = pressurePsi ?? designPressurePsi(s.document);
      const next = rotateHeadDegrees(head, deltaDeg, catalog, pressure);
      return {
        document: patchHeadInDocument(
          s.document,
          s.selectedId,
          {
            rotationDegrees: next.rotationDegrees,
            gpm: next.gpm,
            precipInPerHr: next.precipInPerHr,
          },
          catalog,
          pressure
        ),
        isDirty: true,
      };
    }),

  setSelectedHeadArcDegrees: (arcDegrees, catalog, pressurePsi) =>
    set((s) => {
      if (s.selectedType !== "head" || !s.selectedId) return s;
      const head = s.document.heads.find((h) => h.id === s.selectedId);
      if (!head || head.locked) return s;
      const pressure = pressurePsi ?? designPressurePsi(s.document);
      const next = setHeadArcDegrees(head, arcDegrees, catalog, pressure);
      if (!next) return s;
      return {
        document: patchHeadInDocument(
          s.document,
          s.selectedId,
          {
            arcDegrees: next.arcDegrees,
            gpm: next.gpm,
            precipInPerHr: next.precipInPerHr,
            radiusFeet: next.radiusFeet,
          },
          catalog,
          pressure
        ),
        isDirty: true,
      };
    }),

  adjustSelectedHeadRadius: (deltaFt, catalog, pressurePsi) =>
    set((s) => {
      if (s.selectedType !== "head" || !s.selectedId) return s;
      const head = s.document.heads.find((h) => h.id === s.selectedId);
      if (!head || head.locked) return s;
      const pressure = pressurePsi ?? designPressurePsi(s.document);
      const next = adjustHeadRadius(head, deltaFt, catalog, pressure);
      if (!next) return s;
      return {
        document: patchHeadInDocument(
          s.document,
          s.selectedId,
          {
            radiusFeet: next.radiusFeet,
            gpm: next.gpm,
            precipInPerHr: next.precipInPerHr,
          },
          catalog,
          pressure
        ),
        isDirty: true,
      };
    }),
}));

"use client";

import { create } from "zustand";
import type { DesignDocument, Point, ValidationIssue } from "@/lib/domain/types";
import { EMPTY_DESIGN_DOCUMENT } from "@/lib/domain/types";

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
  zoomIn: () => void;
  zoomOut: () => void;
  resetCanvasView: () => void;
  clearCanvasDesign: () => void;
};

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

  init: (projectId, versionId, versionKind, doc) =>
    set({
      projectId,
      versionId,
      versionKind,
      document: doc,
      isDirty: false,
      drawingVertices: [],
      scalePointA: null,
      scalePointB: null,
      canvasZoom: 1,
      stagePosition: { x: 0, y: 0 },
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
  zoomIn: () =>
    set((s) => ({ canvasZoom: Math.min(4, Math.round(s.canvasZoom * 1.2 * 100) / 100) })),
  zoomOut: () =>
    set((s) => ({ canvasZoom: Math.max(0.25, Math.round((s.canvasZoom / 1.2) * 100) / 100) })),
  resetCanvasView: () => set({ canvasZoom: 1, stagePosition: { x: 0, y: 0 } }),
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
}));

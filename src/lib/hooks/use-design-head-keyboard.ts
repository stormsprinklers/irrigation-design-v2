"use client";

import { useEffect } from "react";
import type { CatalogItemData } from "@/lib/domain/types";
import { DEFAULT_PRESSURE_PSI } from "@/lib/domain/types";
import { useDesignStore } from "@/lib/stores/design-store";
import { TRAINING_HEAD_PRESETS } from "@/lib/domain/training/head-presets";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.closest("[contenteditable='true']")) return true;
  if (target.closest("[role='combobox'], [role='listbox'], [role='textbox']")) return true;
  return false;
}

type Options = {
  catalog: CatalogItemData[];
};

export function useDesignHeadKeyboard({ catalog }: Options) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (useDesignStore.getState().headCanvasInteracting) return;

      const state = useDesignStore.getState();
      if (state.selectedType !== "head" || !state.selectedId) return;

      const head = state.document.heads.find((h) => h.id === state.selectedId);
      if (!head || head.locked) return;

      const mod = e.ctrlKey || e.metaKey;
      const pressure = state.document.waterSource?.staticPressurePsi ?? DEFAULT_PRESSURE_PSI;

      if (mod && e.key.toLowerCase() === "a") {
        return;
      }

      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        state.copySelectedHead();
        return;
      }

      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        state.pasteCopiedHead();
        return;
      }

      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        state.duplicateSelectedHead();
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        state.deleteSelectedHead();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "m") {
        e.preventDefault();
        state.setSelectedHeadArcDegrees(90, catalog, pressure);
        return;
      }
      if (key === "n") {
        e.preventDefault();
        state.setSelectedHeadArcDegrees(180, catalog, pressure);
        return;
      }
      if (key === "b") {
        e.preventDefault();
        state.setSelectedHeadArcDegrees(270, catalog, pressure);
        return;
      }
      if (key === "v" && !mod) {
        e.preventDefault();
        state.setSelectedHeadArcDegrees(360, catalog, pressure);
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        state.adjustSelectedHeadRadius(1, catalog, pressure);
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        state.adjustSelectedHeadRadius(-1, catalog, pressure);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        state.rotateSelectedHead(90, catalog, pressure);
        return;
      }
      if (e.key === "\\" || e.code === "Backslash") {
        e.preventDefault();
        state.flipSelectedHead(catalog, pressure);
        return;
      }
      if (key === "s") {
        e.preventDefault();
        state.applyHeadPreset(TRAINING_HEAD_PRESETS.prosMp2000, catalog);
        return;
      }
      if (key === "r") {
        e.preventDefault();
        state.applyHeadPreset(TRAINING_HEAD_PRESETS.pgpAdj15, catalog);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [catalog]);
}

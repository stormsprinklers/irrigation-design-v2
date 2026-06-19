"use client";

import { Button } from "@/components/ui/button";
import { useTrainingStore } from "@/lib/stores/training-store";
import { resolveDefaultHeadSettings } from "@/lib/catalog/adjustability";
import { stripFieldsFromNozzle } from "@/lib/catalog/strip-pattern";
import { getNozzlesForHead } from "@/lib/catalog/compat";
import { HeadAdjustFields } from "@/components/heads/HeadAdjustFields";
import { HeadCatalogPickers } from "@/components/heads/HeadCatalogPickers";

export function HeadEditorPanel() {
  const catalog = useTrainingStore((s) => s.catalog);
  const correctedHeads = useTrainingStore((s) => s.correctedHeads);
  const selectedHeadIds = useTrainingStore((s) => s.selectedHeadIds);
  const updateCorrectedHead = useTrainingStore((s) => s.updateCorrectedHead);
  const recomputeScores = useTrainingStore((s) => s.recomputeScores);
  const duplicateCorrectedHead = useTrainingStore((s) => s.duplicateCorrectedHead);
  const deleteSelectedHeads = useTrainingStore((s) => s.deleteSelectedHeads);
  const viewMode = useTrainingStore((s) => s.viewMode);

  const head =
    selectedHeadIds.length === 1
      ? correctedHeads.find((h) => h.id === selectedHeadIds[0])
      : undefined;

  if (viewMode === "baseline") {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Switch to Corrected or Compare mode to edit heads.
      </div>
    );
  }

  if (selectedHeadIds.length === 0) {
    return null;
  }

  if (selectedHeadIds.length > 1) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{selectedHeadIds.length} heads selected</h3>
          <Button size="sm" variant="destructive" onClick={() => deleteSelectedHeads()}>
            Delete
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Drag any selected head to move the whole group. Ctrl+D duplicate · Enter rotate 90°
          · Space/Delete/Backspace remove · M/N/B/V set arc · +/- radius. Select one head for
          nozzle and handle edits.
        </p>
      </div>
    );
  }

  if (!head) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Selected head is no longer on the layout.
      </div>
    );
  }

  const nozzle = catalog.find((c) => c.id === head.catalogItemId);

  function patch(
    partial: Parameters<typeof updateCorrectedHead>[1],
    opts?: { deferScores?: boolean }
  ) {
    updateCorrectedHead(head!.id, partial, opts);
  }

  function patchLive(partial: Parameters<typeof updateCorrectedHead>[1]) {
    patch(partial, { deferScores: true });
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Head editor</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => duplicateCorrectedHead(head.id)}>
            Duplicate
          </Button>
          <Button size="sm" variant="destructive" onClick={() => deleteSelectedHeads()}>
            Delete
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {head.nozzleModel ?? head.catalogItemId} · GPM {head.gpm?.toFixed(2) ?? "—"}
      </p>
      <HeadCatalogPickers
        catalog={catalog}
        headBodyId={head.headBodyId}
        catalogItemId={head.catalogItemId}
        bodyLabel="Spray body"
        onBodyChange={(bodyId) => {
          const noz = getNozzlesForHead(catalog, bodyId)[0];
          if (!noz) return;
          const settings = resolveDefaultHeadSettings(noz, 65);
          patch({
            headBodyId: bodyId,
            catalogItemId: noz.id,
            nozzleModel: noz.model,
            ...stripFieldsFromNozzle(noz),
            arcDegrees: settings.arcDegrees,
            radiusFeet: settings.radiusFeet,
            rotationDegrees: settings.rotationDegrees,
            gpm: settings.gpm,
            precipInPerHr: settings.precipInPerHr,
          });
        }}
        onNozzleChange={(catalogItemId) => {
          const noz = catalog.find((c) => c.id === catalogItemId);
          if (!noz) return;
          patch({
            catalogItemId: noz.id,
            nozzleModel: noz.model,
          });
        }}
      />
      {nozzle && (
        <HeadAdjustFields
          head={head}
          nozzle={nozzle}
          pressurePsi={65}
          onChange={(next) => patchLive(next)}
          onAdjustEnd={recomputeScores}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Position: ({head.positionFt.x.toFixed(1)}, {head.positionFt.y.toFixed(1)}) ft
      </p>
    </div>
  );
}

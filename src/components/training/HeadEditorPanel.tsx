"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTrainingStore } from "@/lib/stores/training-store";
import { getNozzleAdjustability, resolveDefaultHeadSettings } from "@/lib/catalog/adjustability";
import { getNozzlesForHead, getHeadBodies } from "@/lib/catalog/compat";
import { wedgeStartDeg, wedgeEndDeg } from "@/lib/domain/placement/wedge";

export function HeadEditorPanel() {
  const catalog = useTrainingStore((s) => s.catalog);
  const correctedHeads = useTrainingStore((s) => s.correctedHeads);
  const selectedHeadId = useTrainingStore((s) => s.selectedHeadId);
  const updateCorrectedHead = useTrainingStore((s) => s.updateCorrectedHead);
  const deleteCorrectedHead = useTrainingStore((s) => s.deleteCorrectedHead);
  const viewMode = useTrainingStore((s) => s.viewMode);

  const head = correctedHeads.find((h) => h.id === selectedHeadId);

  if (viewMode === "baseline") {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Switch to Corrected or Compare mode to edit heads.
      </div>
    );
  }

  if (!head) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a head to edit, or use Add head and click on the lawn.
      </div>
    );
  }

  const nozzle = catalog.find((c) => c.id === head.catalogItemId);
  const adj = nozzle ? getNozzleAdjustability(nozzle) : null;

  function patch(partial: Parameters<typeof updateCorrectedHead>[1]) {
    const next = { ...head!, ...partial };
    const wedgeHead = {
      position: next.positionFt,
      arcDegrees: next.arcDegrees,
      radiusFeet: next.radiusFeet,
      rotationDegrees: next.rotationDegrees,
    };
    updateCorrectedHead(head!.id, {
      ...partial,
      wedgeStartDeg: wedgeStartDeg(wedgeHead),
      wedgeEndDeg: wedgeEndDeg(wedgeHead),
    });
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Head editor</h3>
        <Button size="sm" variant="destructive" onClick={() => deleteCorrectedHead(head.id)}>
          Delete
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {head.nozzleModel ?? head.catalogItemId} · GPM {head.gpm?.toFixed(2) ?? "—"}
      </p>
      <div>
        <Label className="text-xs">Spray body</Label>
        <select
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          value={head.headBodyId ?? ""}
          onChange={(e) => {
            const bodyId = e.target.value;
            const noz = getNozzlesForHead(catalog, bodyId)[0];
            if (!noz) return;
            const settings = resolveDefaultHeadSettings(noz, 65);
            patch({
              headBodyId: bodyId,
              catalogItemId: noz.id,
              nozzleModel: noz.model,
              arcDegrees: settings.arcDegrees,
              radiusFeet: settings.radiusFeet,
              rotationDegrees: settings.rotationDegrees,
              gpm: settings.gpm,
              precipInPerHr: settings.precipInPerHr,
            });
          }}
        >
          {getHeadBodies(catalog).map((b) => (
            <option key={b.id} value={b.id}>
              {b.manufacturer} {b.model}
            </option>
          ))}
        </select>
      </div>
      {head.headBodyId && (
        <div>
          <Label className="text-xs">Nozzle</Label>
          <select
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
            value={head.catalogItemId}
            onChange={(e) => {
              const noz = catalog.find((c) => c.id === e.target.value);
              if (!noz) return;
              const settings = resolveDefaultHeadSettings(noz, 65);
              patch({
                catalogItemId: noz.id,
                nozzleModel: noz.model,
                arcDegrees: settings.arcDegrees,
                radiusFeet: settings.radiusFeet,
                rotationDegrees: settings.rotationDegrees,
                gpm: settings.gpm,
                precipInPerHr: settings.precipInPerHr,
              });
            }}
          >
            {getNozzlesForHead(catalog, head.headBodyId).map((n) => (
              <option key={n.id} value={n.id}>
                {n.model}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <Label className="text-xs">Radius (ft)</Label>
        <input
          type="number"
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          value={head.radiusFeet}
          min={adj?.radiusFeetMin ?? 5}
          max={adj?.radiusFeetMax ?? 40}
          step={0.5}
          onChange={(e) => patch({ radiusFeet: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label className="text-xs">Arc (°)</Label>
        <input
          type="number"
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          value={head.arcDegrees}
          min={adj?.arcDegreesMin ?? 0}
          max={adj?.arcDegreesMax ?? 360}
          step={5}
          onChange={(e) => patch({ arcDegrees: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label className="text-xs">Rotation / arc center (°)</Label>
        <input
          type="number"
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          value={head.rotationDegrees}
          min={0}
          max={359}
          step={5}
          onChange={(e) => patch({ rotationDegrees: Number(e.target.value) })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Arc edges: {head.wedgeStartDeg.toFixed(0)}° – {head.wedgeEndDeg.toFixed(0)}°
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Position: ({head.positionFt.x.toFixed(1)}, {head.positionFt.y.toFixed(1)}) ft
      </p>
    </div>
  );
}

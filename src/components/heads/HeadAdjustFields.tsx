"use client";

import { Label } from "@/components/ui/label";
import type { CatalogItemData } from "@/lib/domain/types";
import { getStripNozzleSpec } from "@/lib/catalog/strip-pattern";
import {
  getNozzleAdjustability,
  patchHeadWithNozzle,
  wedgeBoundsForHead,
} from "@/lib/catalog/adjustability";
import { DeferredNumberInput } from "./DeferredNumberInput";

export type HeadAdjustValues = {
  arcDegrees: number;
  radiusFeet: number;
  rotationDegrees: number;
  gpm?: number;
  precipInPerHr?: number;
  wedgeStartDeg?: number;
  wedgeEndDeg?: number;
  positionFt?: { x: number; y: number };
  position?: { x: number; y: number };
};

type Props = {
  head: HeadAdjustValues;
  nozzle: CatalogItemData;
  pressurePsi: number;
  onChange: (patch: Partial<HeadAdjustValues>) => void;
};

const inputClassName =
  "mt-1 w-full rounded-md border px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60";

function mpBandLabel(band: string | undefined): string | null {
  if (band === "90_210") return "MP adjustable arc: 90°–210° (fixed left edge)";
  if (band === "210_270") return "MP adjustable arc: 210°–270° (fixed left edge)";
  if (band === "360") return "MP full-circle (360° fixed arc)";
  return null;
}

export function HeadAdjustFields({ head, nozzle, pressurePsi, onChange }: Props) {
  const adj = getNozzleAdjustability(nozzle);
  const strip = getStripNozzleSpec(nozzle);

  function applyPatch(
    partial: Partial<Pick<HeadAdjustValues, "arcDegrees" | "radiusFeet" | "rotationDegrees">>
  ) {
    const next = patchHeadWithNozzle(head, partial, nozzle, pressurePsi);
    const wedges = wedgeBoundsForHead({ ...head, ...next });
    onChange({ ...next, ...wedges });
  }

  const bandHint = mpBandLabel(adj.mpArcBand);

  return (
    <div className="space-y-3">
      {strip && (
        <p className="text-xs text-muted-foreground">
          Strip pattern {strip.patternWidthFt} ft wide × {strip.patternLengthFt} ft throw (
          {strip.stripPattern.replace("_", " ")}). Rotate to aim the long axis.
        </p>
      )}
      {bandHint && <p className="text-xs text-muted-foreground">{bandHint}</p>}
      <div>
        <Label className="text-xs">Radius (ft)</Label>
        <DeferredNumberInput
          className={inputClassName}
          value={head.radiusFeet}
          min={adj.radiusFeetMin}
          max={adj.radiusFeetMax}
          step={0.5}
          disabled={!adj.radiusAdjustable}
          onCommit={(n) => applyPatch({ radiusFeet: n })}
        />
      </div>
      <div>
        <Label className="text-xs">Arc (°)</Label>
        <DeferredNumberInput
          className={inputClassName}
          value={head.arcDegrees}
          min={adj.arcDegreesMin}
          max={adj.arcDegreesMax}
          step={5}
          disabled={!adj.arcAdjustable || Boolean(strip)}
          onCommit={(n) => applyPatch({ arcDegrees: n })}
        />
        {(!adj.arcAdjustable || strip) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {strip
              ? "Fixed strip footprint — use rotation to orient"
              : `Fixed at ${adj.arcDegreesDefault}° for this nozzle`}
          </p>
        )}
      </div>
      <div>
        <Label className="text-xs">
          {adj.fixedLeftEdge ? "Rotation (fixed left edge) (°)" : "Rotation / arc center (°)"}
        </Label>
        <DeferredNumberInput
          className={inputClassName}
          value={head.rotationDegrees}
          min={0}
          max={359}
          step={5}
          disabled={!adj.rotationAdjustable}
          onCommit={(n) => applyPatch({ rotationDegrees: n })}
        />
        {head.wedgeStartDeg !== undefined && head.wedgeEndDeg !== undefined && (
          <p className="mt-1 text-xs text-muted-foreground">
            Arc edges: {head.wedgeStartDeg.toFixed(0)}° – {head.wedgeEndDeg.toFixed(0)}°
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import type { CatalogItemData } from "@/lib/domain/types";
import {
  BODY_PICKER_GROUPS,
  NOZZLE_PICKER_GROUPS,
  filterHeadBodiesByGroup,
  filterNozzlesByGroup,
  getBodyPickerGroup,
  getHeadBodies,
  getNozzlePickerGroup,
  getNozzlesForHead,
  type BodyPickerGroup,
  type NozzlePickerGroup,
} from "@/lib/catalog/compat";
import { getNozzleAdjustability } from "@/lib/catalog/adjustability";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/native-select";

type Props = {
  catalog: CatalogItemData[];
  headBodyId?: string;
  catalogItemId?: string;
  bodyLabel?: string;
  nozzleLabel?: string;
  showNozzleDetails?: boolean;
  onBodyChange: (headBodyId: string) => void;
  onNozzleChange: (catalogItemId: string) => void;
};

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={cn(
            "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
            value === opt.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function HeadCatalogPickers({
  catalog,
  headBodyId,
  catalogItemId,
  bodyLabel = "Sprinkler body",
  nozzleLabel = "Nozzle",
  showNozzleDetails = false,
  onBodyChange,
  onNozzleChange,
}: Props) {
  const allBodies = getHeadBodies(catalog);
  const selectedBody = headBodyId ? catalog.find((c) => c.id === headBodyId) : undefined;
  const selectedNozzle = catalogItemId ? catalog.find((c) => c.id === catalogItemId) : undefined;

  const [bodyGroup, setBodyGroup] = useState<BodyPickerGroup>(
    selectedBody ? getBodyPickerGroup(selectedBody) : "spray"
  );
  const [nozzleGroup, setNozzleGroup] = useState<NozzlePickerGroup>(
    selectedNozzle ? getNozzlePickerGroup(selectedNozzle) : "rotary"
  );

  useEffect(() => {
    if (selectedBody) setBodyGroup(getBodyPickerGroup(selectedBody));
  }, [selectedBody?.id]);

  useEffect(() => {
    if (selectedNozzle) setNozzleGroup(getNozzlePickerGroup(selectedNozzle));
  }, [selectedNozzle?.id]);

  const bodiesInGroup = filterHeadBodiesByGroup(allBodies, bodyGroup);
  const bodySelectValue =
    headBodyId && bodiesInGroup.some((b) => b.id === headBodyId) ? headBodyId : "";

  const compatibleNozzles = headBodyId ? getNozzlesForHead(catalog, headBodyId) : [];
  const availableNozzleGroups = NOZZLE_PICKER_GROUPS.filter(
    (g) => filterNozzlesByGroup(compatibleNozzles, g.id).length > 0
  );
  const activeNozzleGroup = availableNozzleGroups.some((g) => g.id === nozzleGroup)
    ? nozzleGroup
    : (availableNozzleGroups[0]?.id ?? nozzleGroup);

  const nozzlesInGroup = filterNozzlesByGroup(compatibleNozzles, activeNozzleGroup);
  const nozzleSelectValue =
    catalogItemId && nozzlesInGroup.some((n) => n.id === catalogItemId)
      ? catalogItemId
      : "";

  return (
    <>
      <div>
        <Label className="text-xs">{bodyLabel}</Label>
        <div className="mt-1 space-y-2">
          <SegmentedControl
            options={BODY_PICKER_GROUPS}
            value={bodyGroup}
            onChange={setBodyGroup}
          />
          <NativeSelect
            value={bodySelectValue}
            onChange={(e) => {
              if (e.target.value) onBodyChange(e.target.value);
            }}
          >
            <option value="">— Select {bodyGroup} body —</option>
            {bodiesInGroup.map((body) => (
              <option key={body.id} value={body.id}>
                {body.manufacturer} {body.model}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {headBodyId && compatibleNozzles.length > 0 && (
        <div>
          <Label className="text-xs">{nozzleLabel}</Label>
          <div className="mt-1 space-y-2">
            {availableNozzleGroups.length > 1 && (
              <SegmentedControl
                options={availableNozzleGroups}
                value={activeNozzleGroup}
                onChange={(group) => {
                  setNozzleGroup(group);
                  const inGroup = filterNozzlesByGroup(compatibleNozzles, group);
                  const keepCurrent = inGroup.some((n) => n.id === catalogItemId);
                  if (!keepCurrent && inGroup[0]) {
                    onNozzleChange(inGroup[0].id);
                  }
                }}
              />
            )}
            <NativeSelect
              value={nozzleSelectValue}
              onChange={(e) => {
                if (e.target.value) onNozzleChange(e.target.value);
              }}
            >
              {nozzleSelectValue === "" && (
                <option value="">— Select {activeNozzleGroup} nozzle —</option>
              )}
              {nozzlesInGroup.map((nozzle) => (
                <option key={nozzle.id} value={nozzle.id}>
                  {nozzle.model}
                </option>
              ))}
            </NativeSelect>
            {showNozzleDetails && selectedNozzle && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const adj = getNozzleAdjustability(selectedNozzle);
                  return (
                    <>
                      Arc {adj.arcDegreesMin}°–{adj.arcDegreesMax}°
                      {adj.arcAdjustable ? " (adj.)" : ""} · Radius {adj.radiusFeetMin}–
                      {adj.radiusFeetMax} ft{adj.radiusAdjustable ? " (adj.)" : ""}
                      {adj.fixedLeftEdge ? " · fixed left edge" : ""}
                    </>
                  );
                })()}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useRef } from "react";
import { useDesignStore } from "@/lib/stores/design-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { generateId } from "@/lib/utils";
import type { CatalogItemData } from "@/lib/domain/types";
import { DEFAULT_PRESSURE_PSI, DEFAULT_WATER_SOURCE } from "@/lib/domain/types";
import {
  getNozzlesForHead,
  nozzleCompatibleWithHead,
} from "@/lib/catalog/compat";
import {
  resolveDefaultHeadSettings,
  swapHeadNozzle,
} from "@/lib/catalog/adjustability";
import { HeadAdjustFields } from "@/components/heads/HeadAdjustFields";
import { HeadCatalogPickers } from "@/components/heads/HeadCatalogPickers";
import { NativeSelect } from "@/components/ui/native-select";

import { cn } from "@/lib/utils";

type Props = {
  catalog: CatalogItemData[];
  onUploadImage: (file: File) => void;
  onAutoPlace: (hydrozoneId: string) => void;
  onValidate: () => void;
  onScaleCalibrate: (feet: number) => void;
  autoPlacing?: boolean;
  mlRefinementEnabled?: boolean;
  mlAvailable?: boolean;
  onMlRefinementChange?: (enabled: boolean) => void;
  className?: string;
  variant?: "sidebar" | "sheet";
};

export function InspectorPanel({
  catalog,
  onUploadImage,
  onAutoPlace,
  onValidate,
  onScaleCalibrate,
  autoPlacing = false,
  mlRefinementEnabled = false,
  mlAvailable = false,
  onMlRefinementChange,
  className,
  variant = "sidebar",
}: Props) {
  const {
    document,
    setDocument,
    selectedId,
    scalePointA,
    scalePointB,
    activeZoneId,
    setActiveZoneId,
  } = useDesignStore();

  const scaleFeetRef = useRef<HTMLInputElement>(null);
  const selectedHead = document.heads.find((h) => h.id === selectedId);
  const selectedHydrozone = document.hydrozones.find((h) => h.id === selectedId);
  const selectedZone = document.zones.find((z) => z.id === activeZoneId);

  function updateWaterSource(field: string, value: string | number | boolean) {
    setDocument({
      ...document,
      waterSource: {
        ...DEFAULT_WATER_SOURCE,
        ...document.waterSource,
        [field]: value,
      },
    });
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-card",
        variant === "sidebar" && "w-80 border-l",
        className
      )}
    >
      <div className="border-b p-4">
        <h2 className="font-semibold">Inspector</h2>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-3" data-tour="tour-property-image">
          <h3 className="text-sm font-medium">Property image</h3>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadImage(file);
            }}
          />
          {document.scale ? (
            <p className="text-xs text-muted-foreground">
              Scale: {document.scale.realWorldFeet} ft reference line
            </p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">Scale not calibrated</p>
          )}
          {scalePointA && scalePointB && !document.scale && (
            <div className="space-y-2">
              <Label>Reference distance (feet)</Label>
              <div className="flex gap-2">
                <Input
                  ref={scaleFeetRef}
                  type="number"
                  placeholder="24"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const feet = Number((e.target as HTMLInputElement).value);
                      if (feet > 0) onScaleCalibrate(feet);
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const feet = Number(scaleFeetRef.current?.value);
                    if (feet > 0) onScaleCalibrate(feet);
                  }}
                >
                  Set
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3" data-tour="tour-water-source">
          <h3 className="text-sm font-medium">Water source</h3>
          <div
            className={cn(
              "grid gap-2",
              variant === "sheet" ? "grid-cols-1" : "grid-cols-2"
            )}
          >
            <div>
              <Label className="text-xs">Static PSI</Label>
              <Input
                type="number"
                value={document.waterSource?.staticPressurePsi ?? DEFAULT_WATER_SOURCE.staticPressurePsi}
                onChange={(e) => updateWaterSource("staticPressurePsi", Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Available GPM</Label>
              <Input
                type="number"
                value={document.waterSource?.availableGpm ?? DEFAULT_WATER_SOURCE.availableGpm}
                onChange={(e) => updateWaterSource("availableGpm", Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Meter (in)</Label>
              <Input
                type="number"
                step="0.25"
                value={document.waterSource?.meterSizeInches ?? DEFAULT_WATER_SOURCE.meterSizeInches}
                onChange={(e) => updateWaterSource("meterSizeInches", Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Mainline (in)</Label>
              <Input
                type="number"
                step="0.25"
                value={document.waterSource?.mainlineSizeInches ?? DEFAULT_WATER_SOURCE.mainlineSizeInches}
                onChange={(e) => updateWaterSource("mainlineSizeInches", Number(e.target.value))}
              />
            </div>
          </div>
          <Input
            placeholder="Backflow type"
            value={document.waterSource?.backflowType ?? DEFAULT_WATER_SOURCE.backflowType}
            onChange={(e) => updateWaterSource("backflowType", e.target.value)}
          />
        </section>

        <section className="space-y-3" data-tour="tour-zone-isolation">
          <h3 className="text-sm font-medium">Zone isolation</h3>
          <NativeSelect
            value={activeZoneId ?? ""}
            onChange={(e) => setActiveZoneId(e.target.value || null)}
          >
            <option value="">All zones</option>
            {document.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </NativeSelect>
          {selectedZone && (
            <p className="text-xs text-muted-foreground">
              Showing {selectedZone.name} — heads, pipes, and hydraulics filtered
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const zone = {
                id: generateId("zone"),
                name: `Zone ${document.zones.length + 1}`,
                hydrozoneIds: [],
              };
              setDocument({ ...document, zones: [...document.zones, zone] });
            }}
          >
            Add zone
          </Button>
        </section>

        <section className="space-y-3" data-tour="tour-auto-place">
          <h3 className="text-sm font-medium">Head placement</h3>
          <p className="text-xs text-muted-foreground">
            Select a hydrozone on the canvas, then auto-place or adjust heads manually.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedHydrozone || autoPlacing}
            onClick={() => selectedHydrozone && onAutoPlace(selectedHydrozone.id)}
          >
            {autoPlacing ? "Placing…" : "Auto-place heads"}
          </Button>
          {mlAvailable && onMlRefinementChange && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={mlRefinementEnabled}
                onChange={(e) => onMlRefinementChange(e.target.checked)}
              />
              ML refinement (beta)
            </label>
          )}
        </section>

        {selectedHydrozone && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Hydrozone: {selectedHydrozone.name}</h3>
            <div>
              <Label className="text-xs">Hydrozone type</Label>
              <NativeSelect
                className="mt-1"
                value={selectedHydrozone.hydrozoneType}
                onChange={(e) => {
                  const hydrozones = document.hydrozones.map((h) =>
                    h.id === selectedHydrozone.id
                      ? { ...h, hydrozoneType: e.target.value as typeof h.hydrozoneType }
                      : h
                  );
                  setDocument({ ...document, hydrozones });
                }}
              >
                {["TURF", "SHRUBS", "TREES", "DRIP", "GARDEN"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="text-xs">Head preference</Label>
              <NativeSelect
                className="mt-1"
                value={selectedHydrozone.headPreference}
                onChange={(e) => {
                  const hydrozones = document.hydrozones.map((h) =>
                    h.id === selectedHydrozone.id
                      ? { ...h, headPreference: e.target.value as typeof h.headPreference }
                      : h
                  );
                  setDocument({ ...document, hydrozones });
                }}
              >
                {["SPRAY", "ROTOR", "MP_ROTATOR", "DRIP"].map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="text-xs">Spacing pattern</Label>
              <NativeSelect
                className="mt-1"
                value={selectedHydrozone.spacingPattern ?? "auto"}
                onChange={(e) => {
                  const value = e.target.value as "auto" | "square" | "triangular";
                  const hydrozones = document.hydrozones.map((h) =>
                    h.id === selectedHydrozone.id
                      ? { ...h, spacingPattern: value === "auto" ? undefined : value }
                      : h
                  );
                  setDocument({ ...document, hydrozones });
                }}
              >
                <option value="auto">Auto-detect</option>
                <option value="square">Square</option>
                <option value="triangular">Triangular</option>
              </NativeSelect>
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-place uses head-to-head spacing with corners first, then edges and interior fill.
            </p>
          </section>
        )}

        {selectedHead && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Head</h3>
            <p className="text-xs text-muted-foreground">
              GPM: {selectedHead.gpm?.toFixed(2) ?? "—"} · Radius: {selectedHead.radiusFeet} ft
            </p>
            <HeadCatalogPickers
              catalog={catalog}
              headBodyId={selectedHead.headBodyId}
              catalogItemId={selectedHead.catalogItemId}
              showNozzleDetails
              onBodyChange={(headBodyId) => {
                const compatible = getNozzlesForHead(catalog, headBodyId);
                const currentNozzle = catalog.find((c) => c.id === selectedHead.catalogItemId);
                const headBody = catalog.find((c) => c.id === headBodyId);
                const nozzle =
                  currentNozzle && headBody && nozzleCompatibleWithHead(currentNozzle, headBody)
                    ? currentNozzle
                    : compatible[0];
                const pressure = document.waterSource?.staticPressurePsi ?? DEFAULT_PRESSURE_PSI;
                const settings = nozzle ? resolveDefaultHeadSettings(nozzle, pressure) : null;
                const heads = document.heads.map((h) =>
                  h.id === selectedHead.id
                    ? {
                        ...h,
                        headBodyId,
                        catalogItemId: nozzle?.id ?? h.catalogItemId,
                        ...(settings ?? {}),
                      }
                    : h
                );
                setDocument({ ...document, heads });
              }}
              onNozzleChange={(catalogItemId) => {
                const nozzle = catalog.find((c) => c.id === catalogItemId);
                if (!nozzle) return;
                const pressure = document.waterSource?.staticPressurePsi ?? DEFAULT_PRESSURE_PSI;
                const hyd = swapHeadNozzle(selectedHead, nozzle, pressure);
                const heads = document.heads.map((h) =>
                  h.id === selectedHead.id
                    ? { ...h, catalogItemId: nozzle.id, ...hyd }
                    : h
                );
                setDocument({ ...document, heads });
              }}
            />
            {selectedHead.headBodyId && selectedHead.catalogItemId && (() => {
              const nozzle = catalog.find((c) => c.id === selectedHead.catalogItemId);
              if (!nozzle) return null;
              const pressure = document.waterSource?.staticPressurePsi ?? DEFAULT_PRESSURE_PSI;
              return (
                <HeadAdjustFields
                  head={selectedHead}
                  nozzle={nozzle}
                  pressurePsi={pressure}
                  onChange={(patch) => {
                    const heads = document.heads.map((h) =>
                      h.id === selectedHead.id ? { ...h, ...patch } : h
                    );
                    setDocument({ ...document, heads });
                  }}
                />
              );
            })()}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedHead.locked}
                onChange={(e) => {
                  const heads = document.heads.map((h) =>
                    h.id === selectedHead.id ? { ...h, locked: e.target.checked } : h
                  );
                  setDocument({ ...document, heads });
                }}
              />
              Lock head
            </label>
            <NativeSelect
              value={selectedHead.zoneId}
              onChange={(e) => {
                const heads = document.heads.map((h) =>
                  h.id === selectedHead.id ? { ...h, zoneId: e.target.value } : h
                );
                setDocument({ ...document, heads });
              }}
            >
              {document.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </NativeSelect>
          </section>
        )}

        <div data-tour="tour-validation">
          <Button variant="outline" className="w-full" onClick={onValidate}>
            Run validation
          </Button>
        </div>
      </div>
    </div>
  );
}

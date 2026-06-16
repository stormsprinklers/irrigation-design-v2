"use client";

import { useRef } from "react";
import { useDesignStore } from "@/lib/stores/design-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { generateId } from "@/lib/utils";

type Props = {
  onUploadImage: (file: File) => void;
  onAutoPlace: (hydrozoneId: string) => void;
  onValidate: () => void;
  onScaleCalibrate: (feet: number) => void;
};

export function InspectorPanel({
  onUploadImage,
  onAutoPlace,
  onValidate,
  onScaleCalibrate,
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
        staticPressurePsi: 50,
        availableGpm: 12,
        meterSizeInches: 1,
        backflowType: "PVB",
        poc: { x: 100, y: 100 },
        mainlineMaterial: "PVC",
        mainlineSizeInches: 1,
        isSecondaryWater: false,
        ...document.waterSource,
        [field]: value,
      },
    });
  }

  return (
    <div className="flex h-full w-80 flex-col border-l bg-card">
      <div className="border-b p-4">
        <h2 className="font-semibold">Inspector</h2>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-3">
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
            <p className="text-xs text-amber-600">Scale not calibrated</p>
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

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Water source</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Static PSI</Label>
              <Input
                type="number"
                value={document.waterSource?.staticPressurePsi ?? ""}
                onChange={(e) => updateWaterSource("staticPressurePsi", Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Available GPM</Label>
              <Input
                type="number"
                value={document.waterSource?.availableGpm ?? ""}
                onChange={(e) => updateWaterSource("availableGpm", Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Meter (in)</Label>
              <Input
                type="number"
                step="0.25"
                value={document.waterSource?.meterSizeInches ?? ""}
                onChange={(e) => updateWaterSource("meterSizeInches", Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Mainline (in)</Label>
              <Input
                type="number"
                step="0.25"
                value={document.waterSource?.mainlineSizeInches ?? ""}
                onChange={(e) => updateWaterSource("mainlineSizeInches", Number(e.target.value))}
              />
            </div>
          </div>
          <Input
            placeholder="Backflow type"
            value={document.waterSource?.backflowType ?? ""}
            onChange={(e) => updateWaterSource("backflowType", e.target.value)}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Zone isolation</h3>
          <select
            className="w-full rounded-md border px-2 py-1.5 text-sm"
            value={activeZoneId ?? ""}
            onChange={(e) => setActiveZoneId(e.target.value || null)}
          >
            <option value="">All zones</option>
            {document.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
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

        {selectedHydrozone && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Hydrozone: {selectedHydrozone.name}</h3>
            <select
              className="w-full rounded-md border px-2 py-1.5 text-sm"
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
            </select>
            <Button size="sm" onClick={() => onAutoPlace(selectedHydrozone.id)}>
              Auto-place heads
            </Button>
          </section>
        )}

        {selectedHead && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Head</h3>
            <p className="text-xs text-muted-foreground">
              GPM: {selectedHead.gpm?.toFixed(2) ?? "—"} · Radius: {selectedHead.radiusFeet} ft
            </p>
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
            <select
              className="w-full rounded-md border px-2 py-1.5 text-sm"
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
            </select>
          </section>
        )}

        <Button variant="outline" className="w-full" onClick={onValidate}>
          Run validation
        </Button>
      </div>
    </div>
  );
}

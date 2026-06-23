"use client";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useDesignStore } from "@/lib/stores/design-store";
import { resolveDefaultHeadSettings } from "@/lib/catalog/adjustability";
import { stripFieldsFromNozzle } from "@/lib/catalog/strip-pattern";
import { getNozzlesForHead } from "@/lib/catalog/compat";
import { HeadAdjustFields } from "@/components/heads/HeadAdjustFields";
import { HeadCatalogPickers } from "@/components/heads/HeadCatalogPickers";
import type { CatalogItemData } from "@/lib/domain/types";
import { DEFAULT_PRESSURE_PSI } from "@/lib/domain/types";

type Props = {
  catalog: CatalogItemData[];
};

export function DesignHeadEditorPanel({ catalog }: Props) {
  const document = useDesignStore((s) => s.document);
  const selectedId = useDesignStore((s) => s.selectedId);
  const selectedType = useDesignStore((s) => s.selectedType);
  const editHead = useDesignStore((s) => s.editHead);
  const patchSelectedHead = useDesignStore((s) => s.patchSelectedHead);
  const duplicateSelectedHead = useDesignStore((s) => s.duplicateSelectedHead);
  const deleteSelectedHead = useDesignStore((s) => s.deleteSelectedHead);
  const setDocument = useDesignStore((s) => s.setDocument);

  const head =
    selectedType === "head" && selectedId
      ? document.heads.find((h) => h.id === selectedId)
      : undefined;

  if (!head) {
    return (
      <div className="space-y-2 p-4">
        <h3 className="text-sm font-medium">Head editor</h3>
        <p className="text-sm text-muted-foreground">
          Select a head on the canvas (Select tool) to change spray body, nozzle, arc, radius, and
          rotation. Use the orange handle to rotate, +/- buttons for arc, and keyboard shortcuts
          below.
        </p>
        <p className="text-xs text-muted-foreground">
          M/N/B/V arc · +/- radius · Enter rotate 90° · \\ flip · Ctrl+C/V copy/paste · Ctrl+D
          duplicate · Delete remove · S/R presets
        </p>
      </div>
    );
  }

  const nozzle = catalog.find((c) => c.id === head.catalogItemId);
  const pressure = document.waterSource?.staticPressurePsi ?? DEFAULT_PRESSURE_PSI;

  function patch(partial: Parameters<typeof editHead>[2]) {
    editHead(head!.id, catalog, partial, pressure);
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Head editor</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => duplicateSelectedHead()}>
            Duplicate
          </Button>
          <Button size="sm" variant="destructive" onClick={() => deleteSelectedHead()}>
            Delete
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {nozzle?.model ?? head.catalogItemId} · GPM {head.gpm?.toFixed(2) ?? "—"} · Radius{" "}
        {head.radiusFeet} ft
      </p>
      <p className="text-xs text-muted-foreground">
        Drag orange handle to rotate · canvas +/- for arc · M/N/B/V arc presets · Enter rotate 90°
        · \\ flip wedge · Ctrl+C/V copy/paste · Delete to remove
      </p>
      <HeadCatalogPickers
        catalog={catalog}
        headBodyId={head.headBodyId}
        catalogItemId={head.catalogItemId}
        bodyLabel="Spray body"
        showNozzleDetails
        onBodyChange={(bodyId) => {
          const noz = getNozzlesForHead(catalog, bodyId)[0];
          if (!noz) return;
          const settings = resolveDefaultHeadSettings(noz, pressure);
          patch({
            headBodyId: bodyId,
            catalogItemId: noz.id,
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
          patch({ catalogItemId: noz.id });
        }}
      />
      {nozzle && (
        <HeadAdjustFields
          head={head}
          nozzle={nozzle}
          pressurePsi={pressure}
          onChange={(next) => patchSelectedHead(catalog, next, pressure)}
        />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={head.locked}
          onChange={(e) => {
            const heads = document.heads.map((h) =>
              h.id === head.id ? { ...h, locked: e.target.checked } : h
            );
            setDocument({ ...document, heads });
          }}
        />
        Lock head
      </label>
      <div>
        <span className="text-xs text-muted-foreground">Zone</span>
        <NativeSelect
          className="mt-1"
          value={head.zoneId}
          onChange={(e) => patch({ zoneId: e.target.value })}
        >
          {document.zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <p className="text-xs text-muted-foreground">
        Position: ({head.position.x.toFixed(0)}, {head.position.y.toFixed(0)}) px
      </p>
    </div>
  );
}

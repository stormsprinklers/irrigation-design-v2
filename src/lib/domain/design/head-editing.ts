import { generateId } from "@/lib/utils";
import {
  getNozzleAdjustability,
  patchHeadWithNozzle,
  swapHeadNozzle,
} from "@/lib/catalog/adjustability";
import type { CatalogItemData, DesignDocument, Point, SprinklerHead } from "@/lib/domain/types";
import { DEFAULT_PRESSURE_PSI } from "@/lib/domain/types";

const DUPLICATE_OFFSET_FT = 2;

export function pixelsPerFootFromDocument(document: DesignDocument): number {
  if (document.scale && document.scale.realWorldFeet > 0) {
    const { pointA, pointB, realWorldFeet } = document.scale;
    return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y) / realWorldFeet;
  }
  return 10;
}

export function designPressurePsi(document: DesignDocument): number {
  return document.waterSource?.staticPressurePsi ?? DEFAULT_PRESSURE_PSI;
}

export function applyDesignHeadPatch(
  head: SprinklerHead,
  patch: Partial<SprinklerHead>,
  catalog: CatalogItemData[],
  pressurePsi = DEFAULT_PRESSURE_PSI
): SprinklerHead {
  const catalogItemId = patch.catalogItemId ?? head.catalogItemId;
  const nozzle = catalog.find((c) => c.id === catalogItemId);
  let next: SprinklerHead = { ...head, ...patch };

  if (patch.catalogItemId && nozzle && patch.catalogItemId !== head.catalogItemId) {
    const hyd = swapHeadNozzle(head, nozzle, pressurePsi);
    next = { ...next, catalogItemId: nozzle.id, ...hyd };
  }

  const geometryTouched =
    patch.arcDegrees !== undefined ||
    patch.rotationDegrees !== undefined ||
    patch.radiusFeet !== undefined;

  if (nozzle && geometryTouched) {
    const hyd = patchHeadWithNozzle(
      next,
      {
        arcDegrees: patch.arcDegrees,
        radiusFeet: patch.radiusFeet,
        rotationDegrees: patch.rotationDegrees,
      },
      nozzle,
      pressurePsi
    );
    next = { ...next, ...hyd };
  }

  return next;
}

export function patchHeadInDocument(
  document: DesignDocument,
  headId: string,
  patch: Partial<SprinklerHead>,
  catalog: CatalogItemData[],
  pressurePsi?: number
): DesignDocument {
  const pressure = pressurePsi ?? designPressurePsi(document);
  return {
    ...document,
    heads: document.heads.map((h) =>
      h.id === headId ? applyDesignHeadPatch(h, patch, catalog, pressure) : h
    ),
  };
}

export function duplicateHead(head: SprinklerHead, ppf: number): SprinklerHead {
  const offset = DUPLICATE_OFFSET_FT * ppf;
  return {
    ...head,
    id: generateId("head"),
    position: { x: head.position.x + offset, y: head.position.y + offset },
    locked: false,
  };
}

export function duplicateHeadInDocument(
  document: DesignDocument,
  headId: string
): { document: DesignDocument; newHeadId: string } | null {
  const source = document.heads.find((h) => h.id === headId);
  if (!source) return null;
  const ppf = pixelsPerFootFromDocument(document);
  const copy = duplicateHead(source, ppf);
  return {
    document: { ...document, heads: [...document.heads, copy] },
    newHeadId: copy.id,
  };
}

export function deleteHeadFromDocument(
  document: DesignDocument,
  headId: string
): DesignDocument {
  return {
    ...document,
    heads: document.heads.filter((h) => h.id !== headId),
  };
}

export function moveHeadInDocument(
  document: DesignDocument,
  headId: string,
  position: Point
): DesignDocument {
  return {
    ...document,
    heads: document.heads.map((h) => (h.id === headId ? { ...h, position } : h)),
  };
}

export function rotateHeadDegrees(
  head: SprinklerHead,
  deltaDeg: number,
  catalog: CatalogItemData[],
  pressurePsi: number
): SprinklerHead {
  const nextRot = ((head.rotationDegrees + deltaDeg) % 360 + 360) % 360;
  return applyDesignHeadPatch(head, { rotationDegrees: nextRot }, catalog, pressurePsi);
}

export function setHeadArcDegrees(
  head: SprinklerHead,
  arcDegrees: number,
  catalog: CatalogItemData[],
  pressurePsi: number
): SprinklerHead | null {
  const nozzle = catalog.find((c) => c.id === head.catalogItemId);
  if (!nozzle) return null;
  const adj = getNozzleAdjustability(nozzle);
  if (!adj.arcAdjustable) return null;
  const next = Math.min(adj.arcDegreesMax, Math.max(adj.arcDegreesMin, arcDegrees));
  return applyDesignHeadPatch(head, { arcDegrees: next }, catalog, pressurePsi);
}

export function adjustHeadRadius(
  head: SprinklerHead,
  deltaFt: number,
  catalog: CatalogItemData[],
  pressurePsi: number
): SprinklerHead | null {
  const nozzle = catalog.find((c) => c.id === head.catalogItemId);
  if (!nozzle) return null;
  const adj = getNozzleAdjustability(nozzle);
  if (!adj.radiusAdjustable) return null;
  return applyDesignHeadPatch(
    head,
    { radiusFeet: head.radiusFeet + deltaFt },
    catalog,
    pressurePsi
  );
}

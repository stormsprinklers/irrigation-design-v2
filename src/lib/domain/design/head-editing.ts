import { generateId } from "@/lib/utils";
import {
  getNozzleAdjustability,
  patchHeadWithNozzle,
  swapHeadNozzle,
} from "@/lib/catalog/adjustability";
import { flippedRotationDegrees } from "@/lib/domain/training/flip-wedge";
import type { CatalogItemData, DesignDocument, Point, SprinklerHead } from "@/lib/domain/types";
import { DEFAULT_PRESSURE_PSI } from "@/lib/domain/types";

const DUPLICATE_OFFSET_FT = 2;
const PASTE_OFFSET_FT = 2;

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

function geometryPatchFromPartial(
  patch: Partial<SprinklerHead>
): Partial<Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees">> {
  const out: Partial<Pick<SprinklerHead, "arcDegrees" | "radiusFeet" | "rotationDegrees">> = {};
  if (patch.arcDegrees !== undefined) out.arcDegrees = patch.arcDegrees;
  if (patch.radiusFeet !== undefined) out.radiusFeet = patch.radiusFeet;
  if (patch.rotationDegrees !== undefined) out.rotationDegrees = patch.rotationDegrees;
  return out;
}

function sanitizeHeadNumbers(head: SprinklerHead): SprinklerHead {
  return {
    ...head,
    arcDegrees: Number.isFinite(head.arcDegrees) ? head.arcDegrees : 360,
    radiusFeet: Number.isFinite(head.radiusFeet) ? head.radiusFeet : 0,
    rotationDegrees: Number.isFinite(head.rotationDegrees) ? head.rotationDegrees : 0,
    gpm: head.gpm !== undefined && Number.isFinite(head.gpm) ? head.gpm : undefined,
    precipInPerHr:
      head.precipInPerHr !== undefined && Number.isFinite(head.precipInPerHr)
        ? head.precipInPerHr
        : undefined,
  };
}

export function applyDesignHeadPatch(
  head: SprinklerHead,
  patch: Partial<SprinklerHead>,
  catalog: CatalogItemData[],
  pressurePsi = DEFAULT_PRESSURE_PSI
): SprinklerHead {
  const safeHead = sanitizeHeadNumbers(head);
  const catalogItemId = patch.catalogItemId ?? safeHead.catalogItemId;
  const nozzle = catalog.find((c) => c.id === catalogItemId);
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter((entry) => entry[1] !== undefined)
  ) as Partial<SprinklerHead>;
  let next: SprinklerHead = { ...safeHead, ...definedPatch };

  if (patch.catalogItemId && nozzle && patch.catalogItemId !== safeHead.catalogItemId) {
    const hyd = swapHeadNozzle(safeHead, nozzle, pressurePsi);
    next = { ...next, catalogItemId: nozzle.id, ...hyd };
  }

  const geometryPatch = geometryPatchFromPartial(patch);
  const geometryTouched = Object.keys(geometryPatch).length > 0;

  if (nozzle && geometryTouched) {
    const hyd = patchHeadWithNozzle(next, geometryPatch, nozzle, pressurePsi);
    next = { ...next, ...hyd };
  }

  return sanitizeHeadNumbers(next);
}

export function sanitizeDesignHeads(document: DesignDocument): DesignDocument {
  return {
    ...document,
    heads: document.heads.map((h) => sanitizeHeadNumbers(h)),
  };
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

export function cloneHeadForClipboard(head: SprinklerHead): SprinklerHead {
  return {
    ...head,
    position: { ...head.position },
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

export function pasteHeadsInDocument(
  document: DesignDocument,
  sources: SprinklerHead[],
  target: Point,
  generation: number
): { document: DesignDocument; newHeadIds: string[] } {
  const ppf = pixelsPerFootFromDocument(document);
  const extra = PASTE_OFFSET_FT * ppf * Math.max(0, generation - 1);
  const centroid = sources.reduce(
    (acc, h) => ({ x: acc.x + h.position.x, y: acc.y + h.position.y }),
    { x: 0, y: 0 }
  );
  const count = sources.length || 1;
  centroid.x /= count;
  centroid.y /= count;

  const pasted = sources.map((source) => {
    const dx = target.x + extra - centroid.x;
    const dy = target.y + extra - centroid.y;
    return {
      ...cloneHeadForClipboard(source),
      id: generateId("head"),
      position: {
        x: source.position.x + dx,
        y: source.position.y + dy,
      },
      locked: false,
    };
  });

  return {
    document: { ...document, heads: [...document.heads, ...pasted] },
    newHeadIds: pasted.map((h) => h.id),
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

export function flipHead(
  head: SprinklerHead,
  catalog: CatalogItemData[],
  pressurePsi: number
): SprinklerHead {
  const rotationDegrees = flippedRotationDegrees(head.rotationDegrees, head.arcDegrees);
  return applyDesignHeadPatch(head, { rotationDegrees }, catalog, pressurePsi);
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

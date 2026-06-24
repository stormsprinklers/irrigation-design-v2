import type { DesignDocument } from "./types";

/** Ensure legacy design JSON has new array fields. */
export function normalizeDesignDocument(data: unknown): DesignDocument {
  const doc = (data ?? {}) as DesignDocument;
  return {
    ...doc,
    hydrozones: doc.hydrozones ?? [],
    exclusionZones: doc.exclusionZones ?? [],
    siteFeatures: doc.siteFeatures ?? [],
    landscapeAreas: doc.landscapeAreas ?? [],
    zones: doc.zones ?? [],
    heads: doc.heads ?? [],
    pipes: doc.pipes ?? [],
    valves: doc.valves ?? [],
    equipment: doc.equipment ?? [],
    metadata: {
      ...doc.metadata,
      units: "imperial" as const,
      quoteTier: doc.metadata?.quoteTier ?? "STANDARD",
    },
  };
}

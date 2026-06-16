import type { DesignDocument, IrrigationZone } from "../types";

const BASE_RUNTIME: Record<string, number> = {
  TURF: 25,
  SHRUBS: 20,
  TREES: 30,
  DRIP: 45,
  GARDEN: 22,
};

export function recommendRuntimes(
  zones: IrrigationZone[],
  doc: DesignDocument
): Record<string, { minutes: number; note: string }> {
  const result: Record<string, { minutes: number; note: string }> = {};

  for (const zone of zones) {
    const hydrozones = doc.hydrozones.filter((h) => zone.hydrozoneIds.includes(h.id));
    const primaryType = hydrozones[0]?.hydrozoneType ?? "TURF";
    let minutes = BASE_RUNTIME[primaryType] ?? 25;

    const sun = hydrozones[0]?.sunExposure;
    if (sun === "FULL_SUN") minutes += 5;
    if (sun === "FULL_SHADE") minutes -= 5;

    const slope = hydrozones[0]?.slopePercent ?? 0;
    if (slope > 10) minutes -= 3;

    result[zone.id] = {
      minutes: Math.max(10, minutes),
      note: "Based on simplified ET₀-style estimate; adjust for local conditions",
    };
  }

  return result;
}

export type TourPlacement = "right" | "left" | "bottom" | "top" | "center";

export type DesignTourStep = {
  id: string;
  target: string;
  title: string;
  body: string;
  placement: TourPlacement;
  scrollIntoView?: boolean;
};

export const DESIGN_TOUR_STEPS: DesignTourStep[] = [
  {
    id: "canvas",
    target: "tour-canvas",
    title: "Your design canvas",
    body: "Draw and edit the property layout here. Everything you place — hydrozones, heads, and pipe — appears on this map.",
    placement: "center",
  },
  {
    id: "property-image",
    target: "tour-property-image",
    title: "Import property image",
    body: "Upload a plat map or aerial photo. This becomes the background for all measurements and head placement.",
    placement: "left",
    scrollIntoView: true,
  },
  {
    id: "tool-scale",
    target: "tour-tool-scale",
    title: "Calibrate scale",
    body: "Click two points on a known distance (e.g. a 24 ft driveway), then enter the real-world feet in the inspector. Required for accurate spacing and pipe sizing.",
    placement: "right",
  },
  {
    id: "water-source",
    target: "tour-water-source",
    title: "Water source",
    body: "Enter static PSI, available GPM, meter size, and mainline info. Hydraulics, validation, and zone sizing all use these numbers.",
    placement: "left",
    scrollIntoView: true,
  },
  {
    id: "tool-hydrozone",
    target: "tour-tool-hydrozone",
    title: "Draw hydrozones",
    body: "Click to add polygon vertices around an irrigated area, then close the shape. Assign turf, shrubs, drip, or garden types in the inspector.",
    placement: "right",
  },
  {
    id: "tool-exclusion",
    target: "tour-tool-exclusion",
    title: "Exclusion zones",
    body: "Mark buildings, driveways, patios, and areas that should not receive overspray. The system warns when heads throw into these zones.",
    placement: "right",
  },
  {
    id: "auto-place",
    target: "tour-auto-place",
    title: "Auto-place heads",
    body: "After drawing a hydrozone, select it and use Auto-place heads. The engine places corners first, then fills edges and interior at head-to-head spacing with overlap validation.",
    placement: "left",
    scrollIntoView: true,
  },
  {
    id: "tool-select",
    target: "tour-tool-select",
    title: "Select and adjust",
    body: "Select heads and drag to reposition. Lock heads you want the algorithm to leave alone when re-running auto-place.",
    placement: "right",
  },
  {
    id: "tool-head",
    target: "tour-tool-head",
    title: "Manual heads",
    body: "Click on the canvas to place individual heads where you need precise control outside the automatic layout.",
    placement: "right",
  },
  {
    id: "tool-pipe",
    target: "tour-tool-pipe",
    title: "Draw pipe",
    body: "Click to trace pipe paths between heads, valves, and the point of connection. Pipe size affects friction loss calculations.",
    placement: "right",
  },
  {
    id: "zone-isolation",
    target: "tour-zone-isolation",
    title: "Zone isolation",
    body: "Filter the canvas to one zone at a time. See only its heads, pipes, GPM, and pressure context while reviewing a design.",
    placement: "left",
    scrollIntoView: true,
  },
  {
    id: "validation",
    target: "tour-validation",
    title: "Validation report",
    body: "Run validation to surface coverage gaps, pressure issues, and flow warnings. The system warns — it never blocks your design.",
    placement: "left",
    scrollIntoView: true,
  },
  {
    id: "materials",
    target: "tour-materials",
    title: "Material estimate",
    body: "Live bill of materials with pipe, heads, fittings, and pricing based on your organization settings. Updates as you design.",
    placement: "top",
  },
  {
    id: "versions",
    target: "tour-versions",
    title: "Versions and sharing",
    body: "Save named versions as designs evolve. Use the share button to send customer or contractor links.",
    placement: "bottom",
  },
];

export const DESIGN_TOUR_STEP_COUNT = DESIGN_TOUR_STEPS.length;

/** Inspector / bottom-panel targets hidden on mobile until user opens a sheet. */
export const MOBILE_HIDDEN_DESIGN_TOUR_TARGETS = new Set([
  "tour-property-image",
  "tour-water-source",
  "tour-auto-place",
  "tour-zone-isolation",
  "tour-validation",
  "tour-materials",
]);

export function isDesignTourStepVisibleOnMobile(target: string): boolean {
  return !MOBILE_HIDDEN_DESIGN_TOUR_TARGETS.has(target);
}

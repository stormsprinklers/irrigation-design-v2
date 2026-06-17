export type TourPlacement = "right" | "left" | "bottom" | "top" | "center";

export type TrainingTourStep = {
  id: string;
  target: string;
  title: string;
  body: string;
  placement: TourPlacement;
  scrollIntoView?: boolean;
};

export const TRAINING_TOUR_STEPS: TrainingTourStep[] = [
  {
    id: "welcome",
    target: "training-tour-header",
    title: "AI Training workspace",
    body: "Generate synthetic lawns, review the placement algorithm, correct head layouts, and save labeled examples for future model training.",
    placement: "center",
  },
  {
    id: "generate",
    target: "training-tour-generate",
    title: "Generate examples",
    body: "Pick a shape class or leave Random, then click Generate. Each example uses a seeded polygon in feet with automatic head placement.",
    placement: "bottom",
  },
  {
    id: "canvas",
    target: "training-tour-canvas",
    title: "Training canvas",
    body: "The lawn polygon, precipitation heatmap, and sprinkler heads appear here. Drag heads in Select mode or click to add new ones.",
    placement: "center",
  },
  {
    id: "view-modes",
    target: "training-tour-view-modes",
    title: "Baseline vs corrected",
    body: "Baseline shows the algorithm output. Corrected is your edited design. Compare overlays both so you can see what changed.",
    placement: "bottom",
  },
  {
    id: "tools",
    target: "training-tour-tools",
    title: "Edit tools",
    body: "Select moves and adjusts heads. Add head lets you click on the lawn to place a new sprinkler manually.",
    placement: "bottom",
  },
  {
    id: "overlays",
    target: "training-tour-overlays",
    title: "Visualization overlays",
    body: "Toggle the precipitation heatmap, sample grid, and spray arcs to judge coverage and uniformity while you edit.",
    placement: "bottom",
  },
  {
    id: "head-editor",
    target: "training-tour-head-editor",
    title: "Head editor",
    body: "Select a head to change nozzle, radius, arc, and rotation. Deletes and catalog changes are logged in the saved training record.",
    placement: "left",
    scrollIntoView: true,
  },
  {
    id: "scores",
    target: "training-tour-scores",
    title: "Uniformity scores",
    body: "DU_LQ, coverage, dry/wet spots, and head-to-head violations update live as you edit. Compare baseline vs corrected improvement.",
    placement: "left",
    scrollIntoView: true,
  },
  {
    id: "approve",
    target: "training-tour-approve",
    title: "Approve and export",
    body: "Approve & Save stores the before/after example to your organization. Export JSONL downloads approved records for ML pipelines.",
    placement: "left",
  },
  {
    id: "saved",
    target: "training-tour-saved",
    title: "Saved examples",
    body: "Expand this list to review previously approved training examples, including shape, area, and algorithm version.",
    placement: "top",
    scrollIntoView: true,
  },
];

export const TRAINING_TOUR_STEP_COUNT = TRAINING_TOUR_STEPS.length;

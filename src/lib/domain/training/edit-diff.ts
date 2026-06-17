import type { Point } from "../types";
import type { TrainingEditLog, TrainingHeadSnapshot } from "./types";

const TRACKED_FIELDS = [
  "radiusFeet",
  "arcDegrees",
  "rotationDegrees",
  "catalogItemId",
  "headBodyId",
  "gpm",
  "precipInPerHr",
] as const;

function positionKey(p: Point): string {
  return `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
}

export function computeEditDiff(
  baseline: TrainingHeadSnapshot[],
  approved: TrainingHeadSnapshot[],
  moveThresholdFt = 0.5
): TrainingEditLog {
  const baselineMap = new Map(baseline.map((h) => [h.id, h]));
  const approvedMap = new Map(approved.map((h) => [h.id, h]));

  const added: string[] = [];
  const deleted: string[] = [];
  const moved: TrainingEditLog["moved"] = [];
  const changed: TrainingEditLog["changed"] = [];

  for (const head of approved) {
    if (!baselineMap.has(head.id)) added.push(head.id);
  }
  for (const head of baseline) {
    if (!approvedMap.has(head.id)) deleted.push(head.id);
  }

  for (const head of approved) {
    const orig = baselineMap.get(head.id);
    if (!orig) continue;

    const deltaFt = Math.hypot(
      head.positionFt.x - orig.positionFt.x,
      head.positionFt.y - orig.positionFt.y
    );
    if (deltaFt >= moveThresholdFt) {
      moved.push({
        id: head.id,
        from: orig.positionFt,
        to: head.positionFt,
        deltaFt: Math.round(deltaFt * 100) / 100,
      });
    }

    for (const field of TRACKED_FIELDS) {
      const from = orig[field];
      const to = head[field];
      if (from !== to) {
        changed.push({ id: head.id, field, from, to });
      }
    }

    if (
      positionKey(orig.positionFt) !== positionKey(head.positionFt) &&
      deltaFt < moveThresholdFt
    ) {
      changed.push({
        id: head.id,
        field: "positionFt",
        from: orig.positionFt,
        to: head.positionFt,
      });
    }
  }

  return { added, deleted, moved, changed };
}

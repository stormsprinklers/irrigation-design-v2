import type { Point } from "../types";
import { isPointInStripPattern, type StripNozzleSpec } from "@/lib/catalog/strip-pattern";
import { isPointInWedge, type WedgeHead } from "./wedge";

export type HeadCoverageInput = WedgeHead & {
  stripPattern?: StripNozzleSpec["stripPattern"];
  patternWidthFt?: number;
  patternLengthFt?: number;
};

export function headStripSpec(head: HeadCoverageInput): StripNozzleSpec | null {
  if (
    !head.stripPattern ||
    head.patternWidthFt == null ||
    head.patternLengthFt == null ||
    head.patternWidthFt <= 0 ||
    head.patternLengthFt <= 0
  ) {
    return null;
  }
  return {
    stripPattern: head.stripPattern,
    patternWidthFt: head.patternWidthFt,
    patternLengthFt: head.patternLengthFt,
  };
}

export function isPointInHeadCoverage(
  head: HeadCoverageInput,
  point: Point,
  ppf: number
): boolean {
  const strip = headStripSpec(head);
  if (strip) {
    return isPointInStripPattern(point, head.position, head.rotationDegrees, strip);
  }
  return isPointInWedge(head, point, ppf);
}

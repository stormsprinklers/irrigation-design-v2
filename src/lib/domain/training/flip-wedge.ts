import { wedgeEndDeg, wedgeStartDeg } from "../placement/wedge";

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Mirror the spray wedge to the opposite side of its bisector (position unchanged).
 * Unlike adding 180° to rotation, this keeps arc width and swaps which bearings are covered.
 */
export function flippedRotationDegrees(
  rotationDegrees: number,
  arcDegrees: number
): number {
  if (arcDegrees >= 359.5) {
    return normalizeDeg(rotationDegrees + 180);
  }
  return normalizeDeg(rotationDegrees + 180 - arcDegrees);
}

export function wedgeBearingsForRotation(
  rotationDegrees: number,
  arcDegrees: number
): { start: number; end: number } {
  const head = { rotationDegrees, arcDegrees };
  return {
    start: wedgeStartDeg(head),
    end: wedgeEndDeg(head),
  };
}

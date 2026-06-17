"use client";

import { Arc, Line } from "react-konva";
import {
  getStripNozzleSpec,
  stripPatternVertices,
  type StripNozzleSpec,
} from "@/lib/catalog/strip-pattern";
import type { CatalogItemData } from "@/lib/domain/types";
import { useCoverageOutline } from "@/lib/hooks/use-canvas-theme";
import { DEFAULT_TAPER_V1_CURVE } from "@/lib/domain/simulation/radial-curve";

type HeadCoverageProps = {
  positionFt: { x: number; y: number };
  pxPerFt: number;
  offsetX?: number;
  offsetY?: number;
  arcDegrees: number;
  radiusFeet: number;
  rotationDegrees: number;
  nozzle?: CatalogItemData | null;
  stripPattern?: StripNozzleSpec["stripPattern"];
  patternWidthFt?: number;
  patternLengthFt?: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  listening?: boolean;
  /** When true, fill tapers from head (strong) to throw edge (weak). Default on. */
  radialFalloff?: boolean;
};

const FALLBACK_RGB = { r: 59, g: 130, b: 246 };

function parseFillRgb(fill: string): { r: number; g: number; b: number } {
  const rgba = fill.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgba) {
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) };
  }
  return FALLBACK_RGB;
}

function parseFillAlpha(fill: string): number {
  const rgba = fill.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/i);
  if (rgba) return Number(rgba[1]);
  return 0.2;
}

/** Color stops for Konva radial/linear gradients matching the precip taper curve. */
export function coverageGradientColorStops(fill: string): (string | number)[] {
  const { r, g, b } = parseFillRgb(fill);
  const peakAlpha = parseFillAlpha(fill);
  const edgeAlpha = Math.max(0.04, peakAlpha * 0.2);
  const ratios = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const stops: (string | number)[] = [];
  for (const ratio of ratios) {
    const strength = DEFAULT_TAPER_V1_CURVE.strengthAtRatio(ratio);
    const alpha = edgeAlpha + (peakAlpha - edgeAlpha) * strength;
    stops.push(ratio, `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
  }
  return stops;
}

function resolveStripSpec(props: HeadCoverageProps): StripNozzleSpec | null {
  if (
    props.stripPattern &&
    props.patternWidthFt != null &&
    props.patternLengthFt != null
  ) {
    return {
      stripPattern: props.stripPattern,
      patternWidthFt: props.patternWidthFt,
      patternLengthFt: props.patternLengthFt,
    };
  }
  if (props.nozzle) return getStripNozzleSpec(props.nozzle);
  return null;
}

export function HeadCoverageShape(props: HeadCoverageProps) {
  const {
    positionFt,
    pxPerFt,
    offsetX = 0,
    offsetY = 0,
    arcDegrees,
    radiusFeet,
    rotationDegrees,
    fill,
    stroke: strokeOverride,
    strokeWidth: strokeWidthOverride,
    listening = false,
    radialFalloff = true,
  } = props;

  const outline = useCoverageOutline();
  const stroke = strokeOverride ?? outline.stroke;
  const strokeWidth = strokeWidthOverride ?? outline.width;
  const gradientStops = radialFalloff ? coverageGradientColorStops(fill) : null;

  const strip = resolveStripSpec(props);
  if (strip) {
    const verts = stripPatternVertices(positionFt, rotationDegrees, strip);
    const flat = verts.flatMap((v) => [
      v.x * pxPerFt + offsetX,
      v.y * pxPerFt + offsetY,
    ]);
    const cx = positionFt.x * pxPerFt + offsetX;
    const cy = positionFt.y * pxPerFt + offsetY;
    const throwPx = Math.max(strip.patternLengthFt, strip.patternWidthFt) * pxPerFt;
    const rad = (rotationDegrees * Math.PI) / 180;
    return (
      <Line
        points={flat}
        closed
        fill={radialFalloff ? undefined : fill}
        {...(radialFalloff && gradientStops
          ? {
              fillLinearGradientStartPoint: { x: cx, y: cy },
              fillLinearGradientEndPoint: {
                x: cx + Math.cos(rad) * throwPx,
                y: cy + Math.sin(rad) * throwPx,
              },
              fillLinearGradientColorStops: gradientStops,
            }
          : {})}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={listening}
      />
    );
  }

  const cx = positionFt.x * pxPerFt + offsetX;
  const cy = positionFt.y * pxPerFt + offsetY;
  const outerRadius = radiusFeet * pxPerFt;

  return (
    <Arc
      x={cx}
      y={cy}
      innerRadius={0}
      outerRadius={outerRadius}
      angle={arcDegrees}
      rotation={rotationDegrees - arcDegrees / 2}
      fill={radialFalloff ? undefined : fill}
      {...(radialFalloff && gradientStops
        ? {
            fillRadialGradientStartPoint: { x: 0, y: 0 },
            fillRadialGradientEndPoint: { x: outerRadius, y: 0 },
            fillRadialGradientColorStops: gradientStops,
          }
        : {})}
      stroke={stroke}
      strokeWidth={strokeWidth}
      listening={listening}
    />
  );
}

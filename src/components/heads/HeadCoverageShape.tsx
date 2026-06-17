"use client";

import { Arc, Line } from "react-konva";
import {
  getStripNozzleSpec,
  stripPatternVertices,
  type StripNozzleSpec,
} from "@/lib/catalog/strip-pattern";
import type { CatalogItemData } from "@/lib/domain/types";
import { useCoverageOutline } from "@/lib/hooks/use-canvas-theme";

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
};

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
  } = props;

  const outline = useCoverageOutline();
  const stroke = strokeOverride ?? outline.stroke;
  const strokeWidth = strokeWidthOverride ?? outline.width;

  const strip = resolveStripSpec(props);
  if (strip) {
    const verts = stripPatternVertices(positionFt, rotationDegrees, strip);
    const flat = verts.flatMap((v) => [
      v.x * pxPerFt + offsetX,
      v.y * pxPerFt + offsetY,
    ]);
    return (
      <Line
        points={flat}
        closed
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={listening}
      />
    );
  }

  const cx = positionFt.x * pxPerFt + offsetX;
  const cy = positionFt.y * pxPerFt + offsetY;

  return (
    <Arc
      x={cx}
      y={cy}
      innerRadius={0}
      outerRadius={radiusFeet * pxPerFt}
      angle={arcDegrees}
      rotation={rotationDegrees - arcDegrees / 2}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      listening={listening}
    />
  );
}

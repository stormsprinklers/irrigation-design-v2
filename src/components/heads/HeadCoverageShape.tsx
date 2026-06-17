"use client";

import { Arc, Line } from "react-konva";
import {
  getStripNozzleSpec,
  stripPatternVertices,
  type StripNozzleSpec,
} from "@/lib/catalog/strip-pattern";
import type { CatalogItemData } from "@/lib/domain/types";

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
    listening = false,
  } = props;

  const strip = resolveStripSpec(props);
  if (strip) {
    const verts = stripPatternVertices(positionFt, rotationDegrees, strip);
    const flat = verts.flatMap((v) => [
      v.x * pxPerFt + offsetX,
      v.y * pxPerFt + offsetY,
    ]);
    return <Line points={flat} closed fill={fill} listening={listening} />;
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
      listening={listening}
    />
  );
}

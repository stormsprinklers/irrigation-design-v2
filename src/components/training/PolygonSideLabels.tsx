"use client";

import { Text } from "react-konva";
import { polygonEdgeLabels } from "@/lib/domain/placement/geometry";
import type { Point } from "@/lib/domain/types";

const LABEL_WIDTH = 52;

type Props = {
  verticesFt: Point[];
  pxPerFt: number;
  stageOffset: number;
};

export function PolygonSideLabels({ verticesFt, pxPerFt, stageOffset }: Props) {
  const labels = polygonEdgeLabels(verticesFt);

  return (
    <>
      {labels.map((label, i) => (
        <Text
          key={i}
          x={label.midpointFt.x * pxPerFt + stageOffset}
          y={label.midpointFt.y * pxPerFt + stageOffset}
          text={label.lengthLabel}
          width={LABEL_WIDTH}
          offsetX={LABEL_WIDTH / 2}
          offsetY={7}
          align="center"
          verticalAlign="middle"
          fontSize={11}
          fontStyle="600"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fill="#14532d"
          stroke="#ffffff"
          strokeWidth={3}
          fillAfterStrokeEnabled
          rotation={label.rotationDeg}
          listening={false}
        />
      ))}
    </>
  );
}

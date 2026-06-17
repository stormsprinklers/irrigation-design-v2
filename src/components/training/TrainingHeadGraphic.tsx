"use client";

import { Arc, Circle, Group, Text } from "react-konva";
import type Konva from "konva";
import { useRef } from "react";
import type { NozzleAdjustability } from "@/lib/catalog/adjustability";
import type { TrainingHeadSnapshot } from "@/lib/domain/training/types";

const PX_PER_FT = 10;

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function polarPx(deg: number, distPx: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * distPx, y: Math.sin(rad) * distPx };
}

type Props = {
  head: TrainingHeadSnapshot;
  stageOffset: number;
  ghost: boolean;
  showArc: boolean;
  editable: boolean;
  selected: boolean;
  adjustability: NozzleAdjustability | null;
  onSelect: () => void;
  onMove: (positionFt: { x: number; y: number }, opts?: { deferScores?: boolean }) => void;
  onPatch: (patch: Partial<TrainingHeadSnapshot>, opts?: { deferScores?: boolean }) => void;
  onInteractionEnd: () => void;
};

export function TrainingHeadGraphic({
  head,
  stageOffset,
  ghost,
  showArc,
  editable,
  selected,
  adjustability,
  onSelect,
  onMove,
  onPatch,
  onInteractionEnd,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const rotatingRef = useRef(false);

  const centerX = head.positionFt.x * PX_PER_FT + stageOffset;
  const centerY = head.positionFt.y * PX_PER_FT + stageOffset;
  const radiusPx = head.radiusFeet * PX_PER_FT;
  const rotDeg = head.rotationDegrees;
  const handleDist = Math.min(Math.max(radiusPx * 0.35, 18), 48);
  const handlePos = polarPx(rotDeg, handleDist);
  const arcBtnDist = Math.min(Math.max(radiusPx * 0.55, 22), 56);
  const minusPos = polarPx(head.wedgeStartDeg, arcBtnDist);
  const plusPos = polarPx(head.wedgeEndDeg, arcBtnDist);

  const arcStep = 5;

  function stopBubble(e: Konva.KonvaEventObject<unknown>) {
    e.cancelBubble = true;
  }

  function feetFromGroup(node: Konva.Group) {
    return {
      x: (node.x() - stageOffset) / PX_PER_FT,
      y: (node.y() - stageOffset) / PX_PER_FT,
    };
  }

  function rotationFromPointer(group: Konva.Node): number | null {
    const g = group as Konva.Group;
    const pos = g.getRelativePointerPosition();
    if (!pos) return null;
    return normalizeDeg((Math.atan2(pos.y, pos.x) * 180) / Math.PI);
  }

  function adjustArc(delta: number) {
    if (!adjustability?.arcAdjustable) return;
    const next = Math.min(
      adjustability.arcDegreesMax,
      Math.max(adjustability.arcDegreesMin, head.arcDegrees + delta)
    );
    if (next !== head.arcDegrees) onPatch({ arcDegrees: next });
  }

  return (
    <Group
      ref={groupRef}
      x={centerX}
      y={centerY}
      draggable={editable && !ghost}
      onClick={(e) => {
        stopBubble(e);
        onSelect();
      }}
      onTap={(e) => {
        stopBubble(e);
        onSelect();
      }}
      onDragStart={stopBubble}
      onDragEnd={(e) => {
        stopBubble(e);
        onMove(feetFromGroup(e.target as Konva.Group));
        onInteractionEnd();
      }}
    >
      {showArc && (
        <Arc
          x={0}
          y={0}
          innerRadius={0}
          outerRadius={radiusPx}
          angle={head.arcDegrees}
          rotation={rotDeg - head.arcDegrees / 2}
          fill={ghost ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.18)"}
          listening={false}
        />
      )}

      <Circle
        x={0}
        y={0}
        radius={selected ? 8 : 6}
        fill={ghost ? "#94a3b8" : selected ? "#2563eb" : "#1d4ed8"}
        listening={!editable}
      />

      {editable && selected && !ghost && (
        <>
          <Circle
            x={handlePos.x}
            y={handlePos.y}
            radius={7}
            fill="#f59e0b"
            stroke="#fff"
            strokeWidth={1.5}
            draggable
            onMouseDown={stopBubble}
            onTouchStart={stopBubble}
            onDragStart={(e) => {
              stopBubble(e);
              rotatingRef.current = true;
              groupRef.current?.draggable(false);
            }}
            onDragMove={(e) => {
              stopBubble(e);
              const group = e.target.getParent();
              if (!group) return;
              const deg = rotationFromPointer(group);
              if (deg == null) return;
              onPatch({ rotationDegrees: deg }, { deferScores: true });
              const p = polarPx(deg, handleDist);
              (e.target as Konva.Circle).position(p);
            }}
            onDragEnd={(e) => {
              stopBubble(e);
              rotatingRef.current = false;
              groupRef.current?.draggable(true);
              const group = e.target.getParent();
              if (group) {
                const deg = rotationFromPointer(group);
                if (deg != null) onPatch({ rotationDegrees: deg });
              }
              onInteractionEnd();
            }}
          />

          {adjustability?.arcAdjustable && (
            <>
              <ArcAdjustButton
                x={minusPos.x}
                y={minusPos.y}
                label="−"
                disabled={head.arcDegrees <= adjustability.arcDegreesMin}
                onPress={() => adjustArc(-arcStep)}
              />
              <ArcAdjustButton
                x={plusPos.x}
                y={plusPos.y}
                label="+"
                disabled={head.arcDegrees >= adjustability.arcDegreesMax}
                onPress={() => adjustArc(arcStep)}
              />
            </>
          )}
        </>
      )}
    </Group>
  );
}

function ArcAdjustButton({
  x,
  y,
  label,
  disabled,
  onPress,
}: {
  x: number;
  y: number;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const size = 16;
  return (
    <Group
      x={x}
      y={y}
      onClick={(e) => {
        e.cancelBubble = true;
        if (!disabled) onPress();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        if (!disabled) onPress();
      }}
    >
      <Circle
        radius={size / 2}
        fill={disabled ? "#e2e8f0" : "#ffffff"}
        stroke={disabled ? "#cbd5e1" : "#2563eb"}
        strokeWidth={1.5}
      />
      <Text
        text={label}
        fontSize={14}
        fontStyle="bold"
        fill={disabled ? "#94a3b8" : "#1d4ed8"}
        width={size}
        height={size}
        offsetX={size / 2}
        offsetY={size / 2}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  );
}

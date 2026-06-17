"use client";

import { Circle, Group, Text } from "react-konva";
import type Konva from "konva";
import { useCallback, useEffect, useRef } from "react";
import type { NozzleAdjustability } from "@/lib/catalog/adjustability";
import type { TrainingHeadSnapshot } from "@/lib/domain/training/types";
import { HeadCoverageShape } from "@/components/heads/HeadCoverageShape";

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
  stripPattern?: TrainingHeadSnapshot["stripPattern"];
  patternWidthFt?: number;
  patternLengthFt?: number;
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
  stripPattern,
  patternWidthFt,
  patternLengthFt,
  onSelect,
  onMove,
  onPatch,
  onInteractionEnd,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const rotatingRef = useRef(false);
  const headRef = useRef(head);
  const adjustabilityRef = useRef(adjustability);
  headRef.current = head;
  adjustabilityRef.current = adjustability;

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
  const stripSpec =
    stripPattern && patternWidthFt && patternLengthFt
      ? { stripPattern, patternWidthFt, patternLengthFt }
      : null;

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

  function adjustArc(delta: number): boolean {
    const adj = adjustabilityRef.current;
    const current = headRef.current;
    if (!adj?.arcAdjustable) return false;
    const next = Math.min(
      adj.arcDegreesMax,
      Math.max(adj.arcDegreesMin, current.arcDegrees + delta)
    );
    if (next === current.arcDegrees) return false;
    headRef.current = { ...current, arcDegrees: next };
    onPatch({ arcDegrees: next }, { deferScores: true });
    return delta > 0 ? next < adj.arcDegreesMax : next > adj.arcDegreesMin;
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
      onDragMove={(e) => {
        stopBubble(e);
        onMove(feetFromGroup(e.target as Konva.Group), { deferScores: true });
      }}
      onDragEnd={(e) => {
        stopBubble(e);
        onMove(feetFromGroup(e.target as Konva.Group));
        onInteractionEnd();
      }}
    >
      {showArc && (
        <HeadCoverageShape
          positionFt={{ x: 0, y: 0 }}
          pxPerFt={PX_PER_FT}
          arcDegrees={head.arcDegrees}
          radiusFeet={head.radiusFeet}
          rotationDegrees={head.rotationDegrees}
          stripPattern={stripSpec?.stripPattern}
          patternWidthFt={stripSpec?.patternWidthFt}
          patternLengthFt={stripSpec?.patternLengthFt}
          fill={ghost ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.18)"}
        />
      )}

      <Circle
        x={0}
        y={0}
        radius={selected ? 8 : 6}
        fill={ghost ? "#94a3b8" : selected ? "#2563eb" : "#1d4ed8"}
        listening={!ghost}
        hitStrokeWidth={editable ? 12 : 0}
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

          {adjustability?.arcAdjustable && !stripSpec && (
            <>
              <ArcAdjustButton
                x={minusPos.x}
                y={minusPos.y}
                label="−"
                disabled={head.arcDegrees <= adjustability.arcDegreesMin}
                onPress={() => adjustArc(-arcStep)}
                onRepeatEnd={onInteractionEnd}
              />
              <ArcAdjustButton
                x={plusPos.x}
                y={plusPos.y}
                label="+"
                disabled={head.arcDegrees >= adjustability.arcDegreesMax}
                onPress={() => adjustArc(arcStep)}
                onRepeatEnd={onInteractionEnd}
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
  onRepeatEnd,
}: {
  x: number;
  y: number;
  label: string;
  disabled: boolean;
  /** Return false when the arc cannot change further in this direction. */
  onPress: () => boolean;
  onRepeatEnd?: () => void;
}) {
  const size = 16;
  const activeRef = useRef(false);
  const timersRef = useRef<{ delay?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }>(
    {}
  );

  const stopRepeat = useCallback(() => {
    const timers = timersRef.current;
    if (timers.delay) clearTimeout(timers.delay);
    if (timers.interval) clearInterval(timers.interval);
    timersRef.current = {};
    window.removeEventListener("mouseup", stopRepeat);
    window.removeEventListener("touchend", stopRepeat);
    window.removeEventListener("touchcancel", stopRepeat);
    if (activeRef.current) {
      activeRef.current = false;
      onRepeatEnd?.();
    }
  }, [onRepeatEnd]);

  const tick = useCallback(() => {
    if (disabled) {
      stopRepeat();
      return;
    }
    if (!onPress()) stopRepeat();
  }, [disabled, onPress, stopRepeat]);

  const startRepeat = useCallback(
    (e: Konva.KonvaEventObject<unknown>) => {
      e.cancelBubble = true;
      if (disabled) return;
      stopRepeat();
      activeRef.current = true;
      tick();
      window.addEventListener("mouseup", stopRepeat);
      window.addEventListener("touchend", stopRepeat);
      window.addEventListener("touchcancel", stopRepeat);
      timersRef.current.delay = setTimeout(() => {
        timersRef.current.interval = setInterval(tick, 70);
      }, 350);
    },
    [disabled, stopRepeat, tick]
  );

  useEffect(() => () => stopRepeat(), [stopRepeat]);

  useEffect(() => {
    if (disabled) stopRepeat();
  }, [disabled, stopRepeat]);

  return (
    <Group
      x={x}
      y={y}
      onMouseDown={startRepeat}
      onTouchStart={startRepeat}
      onClick={(e) => {
        e.cancelBubble = true;
      }}
      onTap={(e) => {
        e.cancelBubble = true;
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

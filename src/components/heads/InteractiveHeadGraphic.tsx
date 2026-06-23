"use client";

import { Circle, Group, Text } from "react-konva";
import type Konva from "konva";
import { useCallback, useEffect, useRef } from "react";
import type { NozzleAdjustability } from "@/lib/catalog/adjustability";
import type { CatalogItemData } from "@/lib/domain/types";
import type { StripNozzleSpec } from "@/lib/catalog/strip-pattern";
import { HeadCoverageShape } from "@/components/heads/HeadCoverageShape";

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function polarPx(deg: number, distPx: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * distPx, y: Math.sin(rad) * distPx };
}

export type InteractiveHeadGeometry = {
  arcDegrees: number;
  radiusFeet: number;
  rotationDegrees: number;
};

type MoveOpts = { live?: boolean };

type Props = {
  centerX: number;
  centerY: number;
  pxPerFt: number;
  head: InteractiveHeadGeometry;
  ghost: boolean;
  showArc: boolean;
  editable: boolean;
  selected: boolean;
  locked?: boolean;
  showAdjustHandles: boolean;
  adjustability: NozzleAdjustability | null;
  coverageFill: string;
  nozzle?: CatalogItemData | null;
  stripPattern?: StripNozzleSpec["stripPattern"];
  patternWidthFt?: number;
  patternLengthFt?: number;
  headMarkerRadius?: number;
  headHitStrokeWidth?: number;
  listening?: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: () => void;
  onMove: (position: { x: number; y: number }, opts?: MoveOpts) => void;
  onDragEnd?: () => void;
  onPatch: (
    patch: Partial<Pick<InteractiveHeadGeometry, "arcDegrees" | "radiusFeet" | "rotationDegrees">>,
    opts?: MoveOpts
  ) => void;
  onInteractionStart?: () => void;
  onInteractionEnd: () => void;
};

export function InteractiveHeadGraphic({
  centerX,
  centerY,
  pxPerFt,
  head,
  ghost,
  showArc,
  editable,
  selected,
  locked = false,
  showAdjustHandles,
  adjustability,
  coverageFill,
  nozzle,
  stripPattern,
  patternWidthFt,
  patternLengthFt,
  headMarkerRadius,
  headHitStrokeWidth = 12,
  listening = true,
  onSelect,
  onDragStart,
  onMove,
  onDragEnd,
  onPatch,
  onInteractionStart,
  onInteractionEnd,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const headRef = useRef(head);
  const adjustabilityRef = useRef(adjustability);
  headRef.current = head;
  adjustabilityRef.current = adjustability;

  const radiusPx = head.radiusFeet * pxPerFt;
  const rotDeg = head.rotationDegrees;
  const handleDist = Math.min(Math.max(radiusPx * 0.35, 18), 48);
  const handlePos = polarPx(rotDeg, handleDist);
  const arcBtnGap = 18;
  const arcClusterDist = Math.max((selected ? 9 : 6) + 16, 22);
  const arcClusterAngle = rotDeg + 180;
  const arcClusterCenter = polarPx(arcClusterAngle, arcClusterDist);
  const arcTangent = polarPx(arcClusterAngle + 90, arcBtnGap / 2);
  const minusPos = {
    x: arcClusterCenter.x - arcTangent.x,
    y: arcClusterCenter.y - arcTangent.y,
  };
  const plusPos = {
    x: arcClusterCenter.x + arcTangent.x,
    y: arcClusterCenter.y + arcTangent.y,
  };

  const arcStep = 5;
  const stripSpec =
    stripPattern && patternWidthFt && patternLengthFt
      ? { stripPattern, patternWidthFt, patternLengthFt }
      : null;
  const markerRadius = headMarkerRadius ?? (selected ? 9 : 6);
  const canEdit = editable && !ghost && !locked;

  function stopBubble(e: Konva.KonvaEventObject<unknown>) {
    e.cancelBubble = true;
  }

  function positionFromGroup(node: Konva.Group) {
    return { x: node.x(), y: node.y() };
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
    onPatch({ arcDegrees: next }, { live: true });
    return delta > 0 ? next < adj.arcDegreesMax : next > adj.arcDegreesMin;
  }

  function stopDragScroll(e: Konva.KonvaEventObject<unknown>) {
    stopBubble(e);
    onInteractionStart?.();
  }

  return (
    <Group
      ref={groupRef}
      x={centerX}
      y={centerY}
      listening={listening}
      draggable={canEdit}
      onMouseDown={stopBubble}
      onTouchStart={stopBubble}
      onClick={(e) => {
        stopBubble(e);
        onSelect(e);
      }}
      onTap={(e) => {
        stopBubble(e);
        onSelect(e);
      }}
      onDragStart={(e) => {
        stopDragScroll(e);
        onDragStart?.();
      }}
      onDragMove={(e) => {
        stopBubble(e);
        onMove(positionFromGroup(e.target as Konva.Group), { live: true });
      }}
      onDragEnd={(e) => {
        stopBubble(e);
        onMove(positionFromGroup(e.target as Konva.Group));
        onDragEnd?.();
        onInteractionEnd();
      }}
    >
      {showArc && (
        <HeadCoverageShape
          positionFt={{ x: 0, y: 0 }}
          pxPerFt={pxPerFt}
          arcDegrees={head.arcDegrees}
          radiusFeet={head.radiusFeet}
          rotationDegrees={head.rotationDegrees}
          nozzle={nozzle}
          stripPattern={stripSpec?.stripPattern}
          patternWidthFt={stripSpec?.patternWidthFt}
          patternLengthFt={stripSpec?.patternLengthFt}
          fill={coverageFill}
        />
      )}

      {selected && !ghost && (
        <>
          <Circle
            x={0}
            y={0}
            radius={16}
            stroke="#38bdf8"
            strokeWidth={4}
            opacity={0.95}
            shadowBlur={16}
            shadowColor="#0ea5e9"
            shadowOpacity={0.85}
            listening={false}
          />
          <Circle
            x={0}
            y={0}
            radius={12}
            stroke="#bae6fd"
            strokeWidth={2}
            opacity={0.7}
            listening={false}
          />
        </>
      )}

      <Circle
        x={0}
        y={0}
        radius={markerRadius}
        fill={ghost ? "#94a3b8" : locked ? "#f59e0b" : selected ? "#2563eb" : "#1d4ed8"}
        stroke={selected ? "#ffffff" : undefined}
        strokeWidth={selected ? 2 : 0}
        listening={!ghost}
        hitStrokeWidth={canEdit ? headHitStrokeWidth : 0}
      />

      {canEdit && showAdjustHandles && (
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
              stopDragScroll(e);
              groupRef.current?.draggable(false);
            }}
            onDragMove={(e) => {
              stopBubble(e);
              const group = e.target.getParent();
              if (!group) return;
              const deg = rotationFromPointer(group);
              if (deg == null) return;
              onPatch({ rotationDegrees: deg }, { live: true });
              const p = polarPx(deg, handleDist);
              (e.target as Konva.Circle).position(p);
            }}
            onDragEnd={(e) => {
              stopBubble(e);
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
                onPressStart={() => {
                  onInteractionStart?.();
                  groupRef.current?.draggable(false);
                }}
                onPressEnd={() => {
                  groupRef.current?.draggable(true);
                  onInteractionEnd();
                }}
              />
              <ArcAdjustButton
                x={plusPos.x}
                y={plusPos.y}
                label="+"
                disabled={head.arcDegrees >= adjustability.arcDegreesMax}
                onPress={() => adjustArc(arcStep)}
                onPressStart={() => {
                  onInteractionStart?.();
                  groupRef.current?.draggable(false);
                }}
                onPressEnd={() => {
                  groupRef.current?.draggable(true);
                  onInteractionEnd();
                }}
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
  onPressStart,
  onPressEnd,
}: {
  x: number;
  y: number;
  label: string;
  disabled: boolean;
  onPress: () => boolean;
  onPressStart?: () => void;
  onPressEnd?: () => void;
}) {
  const size = 16;
  const hitPad = 6;
  const pressingRef = useRef(false);
  const timersRef = useRef<{
    delay?: ReturnType<typeof setTimeout>;
    interval?: ReturnType<typeof setInterval>;
  }>({});
  const onPressRef = useRef(onPress);
  const onPressEndRef = useRef(onPressEnd);
  const disabledRef = useRef(disabled);
  onPressRef.current = onPress;
  onPressEndRef.current = onPressEnd;
  disabledRef.current = disabled;

  const endPress = useCallback(() => {
    const timers = timersRef.current;
    if (timers.delay) clearTimeout(timers.delay);
    if (timers.interval) clearInterval(timers.interval);
    timersRef.current = {};
    window.removeEventListener("pointerup", endPress);
    window.removeEventListener("pointercancel", endPress);
    window.removeEventListener("mouseup", endPress);
    window.removeEventListener("touchend", endPress);
    window.removeEventListener("touchcancel", endPress);
    if (pressingRef.current) {
      pressingRef.current = false;
      onPressEndRef.current?.();
    }
  }, []);

  const tick = useCallback(() => {
    if (disabledRef.current) {
      endPress();
      return;
    }
    if (!onPressRef.current()) endPress();
  }, [endPress]);

  const beginPress = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;
      if (disabledRef.current) return;
      endPress();
      pressingRef.current = true;
      onPressStart?.();
      tick();
      window.addEventListener("pointerup", endPress);
      window.addEventListener("pointercancel", endPress);
      window.addEventListener("mouseup", endPress);
      window.addEventListener("touchend", endPress);
      window.addEventListener("touchcancel", endPress);
      timersRef.current.delay = setTimeout(() => {
        timersRef.current.interval = setInterval(tick, 75);
      }, 300);
    },
    [endPress, onPressStart, tick]
  );

  useEffect(() => () => endPress(), [endPress]);

  return (
    <Group
      x={x}
      y={y}
      onMouseDown={beginPress}
      onTouchStart={beginPress}
      onMouseUp={(e) => {
        e.cancelBubble = true;
        endPress();
      }}
      onTouchEnd={(e) => {
        e.cancelBubble = true;
        endPress();
      }}
      onClick={(e) => {
        e.cancelBubble = true;
      }}
      onTap={(e) => {
        e.cancelBubble = true;
      }}
    >
      <Circle radius={size / 2 + hitPad} fill="rgba(0,0,0,0.001)" listening />
      <Circle
        radius={size / 2}
        fill={disabled ? "#e2e8f0" : "#ffffff"}
        stroke={disabled ? "#cbd5e1" : "#2563eb"}
        strokeWidth={1.5}
        listening={false}
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

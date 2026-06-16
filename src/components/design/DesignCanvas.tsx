"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Image as KonvaImage, Arc, Group } from "react-konva";
import type Konva from "konva";
import { useDesignStore } from "@/lib/stores/design-store";
import { distanceBetweenPoints, generateId, POLYGON_CLOSE_RADIUS } from "@/lib/utils";
import type { HydrozonePolygon, ExclusionZone, Point } from "@/lib/domain/types";

const HYDROZONE_COLORS: Record<string, string> = {
  TURF: "rgba(34, 197, 94, 0.25)",
  SHRUBS: "rgba(132, 204, 22, 0.25)",
  TREES: "rgba(22, 163, 74, 0.25)",
  DRIP: "rgba(59, 130, 246, 0.25)",
  GARDEN: "rgba(234, 179, 8, 0.25)",
};

const POLYGON_DRAW_STYLES = {
  hydrozone: {
    stroke: "#16a34a",
    fill: "rgba(34, 197, 94, 0.15)",
    vertex: "#22c55e",
    firstVertex: "#16a34a",
  },
  exclusion: {
    stroke: "#dc2626",
    fill: "rgba(239, 68, 68, 0.12)",
    vertex: "#f87171",
    firstVertex: "#dc2626",
  },
} as const;

function useBackgroundImage(url?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.src = url;
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
  }, [url]);
  return image;
}

type Props = {
  imageUrl?: string;
  onCanvasClick: (point: Point) => void;
  onClosePolygon?: () => void;
};

export function DesignCanvas({ imageUrl, onCanvasClick, onClosePolygon }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastResetRef = useRef(0);
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null);
  const {
    document,
    activeTool,
    activeZoneId,
    drawingVertices,
    scalePointA,
    scalePointB,
    selectedId,
    canvasZoom,
    stagePosition,
    viewportSize,
    canvasViewResetAt,
    setSelected,
    setDocument,
    setCanvasView,
    setViewportSize,
    setContentSize,
    centerCanvasView,
  } = useDesignStore();

  const bgImage = useBackgroundImage(imageUrl);
  const width = document.propertyImage?.width ?? 1200;
  const height = document.propertyImage?.height ?? 800;

  useEffect(() => {
    setContentSize(width, height);
  }, [width, height, setContentSize]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateViewport = () => {
      setViewportSize(el.clientWidth, el.clientHeight);
    };

    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(el);
    return () => observer.disconnect();
  }, [setViewportSize]);

  useEffect(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return;

    const store = useDesignStore.getState();
    if (canvasViewResetAt !== lastResetRef.current) {
      lastResetRef.current = canvasViewResetAt;
      centerCanvasView();
      return;
    }

    if (store.stagePosition.x === 0 && store.stagePosition.y === 0) {
      centerCanvasView();
    }
  }, [viewportSize.width, viewportSize.height, canvasViewResetAt, centerCanvasView]);

  const isDrawingPolygon = activeTool === "hydrozone" || activeTool === "exclusion";
  const drawStyle = isDrawingPolygon ? POLYGON_DRAW_STYLES[activeTool] : null;

  const nearFirstVertex =
    isDrawingPolygon &&
    drawingVertices.length >= 3 &&
    previewPoint !== null &&
    distanceBetweenPoints(previewPoint, drawingVertices[0]) <= POLYGON_CLOSE_RADIUS;

  useEffect(() => {
    if (!isDrawingPolygon) {
      setPreviewPoint(null);
    }
  }, [isDrawingPolygon]);

  function isDimmed(zoneId?: string) {
    return activeZoneId !== null && zoneId !== activeZoneId;
  }

  function getPointerPosition(): Point | null {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const transform = layer.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pos);
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = canvasZoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / oldScale,
      y: (pointer.y - stagePosition.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const scaleFactor = 1.08;
    const newScale =
      direction > 0
        ? Math.min(4, oldScale * scaleFactor)
        : Math.max(0.25, oldScale / scaleFactor);
    const roundedScale = Math.round(newScale * 100) / 100;

    setCanvasView(roundedScale, {
      x: pointer.x - mousePointTo.x * roundedScale,
      y: pointer.y - mousePointTo.y * roundedScale,
    });
  }

  function handleLayerDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    setCanvasView(canvasZoom, { x: e.target.x(), y: e.target.y() });
  }

  function handleLayerDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    setCanvasView(canvasZoom, { x: e.target.x(), y: e.target.y() });
  }

  function handleStageMouseMove() {
    if (!isDrawingPolygon || drawingVertices.length === 0) return;
    setPreviewPoint(getPointerPosition());
  }

  function handleStageMouseLeave() {
    setPreviewPoint(null);
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (activeTool === "pan") return;
    const stage = e.target.getStage();
    if (!stage || e.target !== stage) return;
    const pos = getPointerPosition();
    if (!pos) return;
    onCanvasClick(pos);
  }

  function handleFirstVertexClick(e: Konva.KonvaEventObject<MouseEvent>) {
    e.cancelBubble = true;
    if (drawingVertices.length >= 3) {
      onClosePolygon?.();
    }
  }

  function handleHeadDrag(headId: string, x: number, y: number) {
    const heads = document.heads.map((h) =>
      h.id === headId && !h.locked ? { ...h, position: { x, y } } : h
    );
    setDocument({ ...document, heads });
  }

  const previewPolygonPoints =
    previewPoint && drawingVertices.length >= 2
      ? [...drawingVertices, previewPoint]
      : null;

  const stageWidth = Math.max(viewportSize.width, 1);
  const stageHeight = Math.max(viewportSize.height, 1);
  const isPanTool = activeTool === "pan";

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-muted/30">
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        onClick={handleStageClick}
        onMouseMove={handleStageMouseMove}
        onMouseLeave={handleStageMouseLeave}
        onWheel={handleWheel}
        style={{
          cursor: isDrawingPolygon
            ? "crosshair"
            : isPanTool
              ? "grab"
              : undefined,
        }}
      >
        <Layer
          ref={layerRef}
          x={stagePosition.x}
          y={stagePosition.y}
          scaleX={canvasZoom}
          scaleY={canvasZoom}
          draggable={isPanTool}
          onDragMove={handleLayerDragMove}
          onDragEnd={handleLayerDragEnd}
        >
          {bgImage && (
            <KonvaImage image={bgImage} width={width} height={height} listening={false} />
          )}
          {!bgImage && (
            <Line
              points={[0, 0, width, 0, width, height, 0, height]}
              closed
              fill="#f8fafc"
              stroke="#e2e8f0"
              listening={false}
            />
          )}

          {document.exclusionZones.map((zone) => (
            <ExclusionShape
              key={zone.id}
              zone={zone}
              opacity={isDimmed() ? 0.2 : 0.6}
              selected={selectedId === zone.id}
              listening={!isPanTool}
              onSelect={() => setSelected(zone.id, "exclusion")}
            />
          ))}

          {document.hydrozones.map((zone) => (
            <HydrozoneShape
              key={zone.id}
              zone={zone}
              fill={HYDROZONE_COLORS[zone.hydrozoneType] ?? "rgba(34,197,94,0.25)"}
              opacity={isDimmed(zone.zoneId) ? 0.2 : 0.7}
              selected={selectedId === zone.id}
              listening={!isPanTool}
              onSelect={() => setSelected(zone.id, "hydrozone")}
            />
          ))}

          {document.pipes.map((pipe) => (
            <Line
              key={pipe.id}
              points={pipe.points.flatMap((p) => [p.x, p.y])}
              stroke={isDimmed(pipe.zoneId) ? "#94a3b8" : "#1e40af"}
              strokeWidth={Math.max(2, pipe.diameterInches * 2)}
              opacity={isDimmed(pipe.zoneId) ? 0.2 : 0.9}
              listening={!isPanTool}
              onClick={() => setSelected(pipe.id, "pipe")}
            />
          ))}

          {document.heads.map((head) => {
            const dimmed = isDimmed(head.zoneId);
            const showArc = !activeZoneId || activeZoneId === head.zoneId;
            const ppf =
              document.scale && document.scale.realWorldFeet > 0
                ? Math.hypot(
                    document.scale.pointB.x - document.scale.pointA.x,
                    document.scale.pointB.y - document.scale.pointA.y
                  ) / document.scale.realWorldFeet
                : 10;
            const radiusPx = head.radiusFeet * ppf;

            return (
              <Group key={head.id} listening={!isPanTool}>
                {showArc && (
                  <Arc
                    x={head.position.x}
                    y={head.position.y}
                    innerRadius={0}
                    outerRadius={radiusPx}
                    angle={head.arcDegrees}
                    rotation={head.rotationDegrees - head.arcDegrees / 2}
                    fill={dimmed ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.15)"}
                    listening={false}
                  />
                )}
                <Circle
                  x={head.position.x}
                  y={head.position.y}
                  radius={6}
                  fill={head.locked ? "#f59e0b" : selectedId === head.id ? "#2563eb" : "#1d4ed8"}
                  opacity={dimmed ? 0.2 : 1}
                  draggable={activeTool === "select" && !head.locked}
                  onDragEnd={(e) => handleHeadDrag(head.id, e.target.x(), e.target.y())}
                  onClick={() => setSelected(head.id, "head")}
                />
              </Group>
            );
          })}

          {document.valves.map((valve) => (
            <Circle
              key={valve.id}
              x={valve.position.x}
              y={valve.position.y}
              radius={8}
              fill="#dc2626"
              opacity={isDimmed(valve.zoneId) ? 0.2 : 1}
              listening={!isPanTool}
              onClick={() => setSelected(valve.id, "valve")}
            />
          ))}

          {document.waterSource?.poc && (
            <Circle
              x={document.waterSource.poc.x}
              y={document.waterSource.poc.y}
              radius={10}
              fill="#7c3aed"
              stroke="#fff"
              strokeWidth={2}
              listening={!isPanTool}
            />
          )}

          {isDrawingPolygon && drawingVertices.length > 0 && drawStyle && (
            <>
              {previewPolygonPoints && previewPolygonPoints.length >= 3 && (
                <Line
                  points={previewPolygonPoints.flatMap((p) => [p.x, p.y])}
                  closed
                  fill={drawStyle.fill}
                  stroke={drawStyle.stroke}
                  strokeWidth={1}
                  opacity={0.85}
                  listening={false}
                />
              )}

              {drawingVertices.length >= 2 && (
                <Line
                  points={drawingVertices.flatMap((p) => [p.x, p.y])}
                  stroke={drawStyle.stroke}
                  strokeWidth={2}
                  listening={false}
                />
              )}

              {previewPoint && drawingVertices.length > 0 && (
                <Line
                  points={[
                    drawingVertices[drawingVertices.length - 1].x,
                    drawingVertices[drawingVertices.length - 1].y,
                    previewPoint.x,
                    previewPoint.y,
                  ]}
                  stroke={drawStyle.stroke}
                  strokeWidth={2}
                  dash={[6, 4]}
                  listening={false}
                />
              )}

              {previewPoint &&
                drawingVertices.length >= 3 &&
                nearFirstVertex && (
                  <Line
                    points={[
                      previewPoint.x,
                      previewPoint.y,
                      drawingVertices[0].x,
                      drawingVertices[0].y,
                    ]}
                    stroke={drawStyle.firstVertex}
                    strokeWidth={2}
                    dash={[4, 4]}
                    listening={false}
                  />
                )}

              {drawingVertices.map((vertex, index) => {
                const isFirst = index === 0;
                const canClose = isFirst && drawingVertices.length >= 3;
                const isNear = isFirst && nearFirstVertex;

                return (
                  <Group key={`draw-vertex-${index}`}>
                    {canClose && (
                      <Circle
                        x={vertex.x}
                        y={vertex.y}
                        radius={POLYGON_CLOSE_RADIUS}
                        stroke={drawStyle.firstVertex}
                        strokeWidth={isNear ? 2 : 1}
                        dash={[4, 4]}
                        opacity={isNear ? 0.9 : 0.45}
                        onClick={handleFirstVertexClick}
                      />
                    )}
                    <Circle
                      x={vertex.x}
                      y={vertex.y}
                      radius={isFirst && canClose ? 7 : 5}
                      fill={isFirst ? drawStyle.firstVertex : drawStyle.vertex}
                      stroke="#ffffff"
                      strokeWidth={2}
                      onClick={isFirst ? handleFirstVertexClick : undefined}
                    />
                  </Group>
                );
              })}
            </>
          )}

          {scalePointA && <Circle x={scalePointA.x} y={scalePointA.y} radius={5} fill="#ea580c" />}
          {scalePointB && <Circle x={scalePointB.x} y={scalePointB.y} radius={5} fill="#ea580c" />}
          {scalePointA && scalePointB && (
            <Line
              points={[scalePointA.x, scalePointA.y, scalePointB.x, scalePointB.y]}
              stroke="#ea580c"
              strokeWidth={2}
            />
          )}
        </Layer>
      </Stage>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border bg-card/95 px-2 py-1 text-xs text-muted-foreground shadow-sm">
        {Math.round(canvasZoom * 100)}%
      </div>
    </div>
  );
}

function HydrozoneShape({
  zone,
  fill,
  opacity,
  selected,
  listening = true,
  onSelect,
}: {
  zone: HydrozonePolygon;
  fill: string;
  opacity: number;
  selected: boolean;
  listening?: boolean;
  onSelect: () => void;
}) {
  return (
    <Line
      points={zone.vertices.flatMap((p) => [p.x, p.y])}
      closed
      fill={fill}
      stroke={selected ? "#16a34a" : "#22c55e"}
      strokeWidth={selected ? 3 : 1}
      opacity={opacity}
      listening={listening}
      onClick={listening ? onSelect : undefined}
    />
  );
}

function ExclusionShape({
  zone,
  opacity,
  selected,
  listening = true,
  onSelect,
}: {
  zone: ExclusionZone;
  opacity: number;
  selected: boolean;
  listening?: boolean;
  onSelect: () => void;
}) {
  return (
    <Line
      points={zone.vertices.flatMap((p) => [p.x, p.y])}
      closed
      fill="rgba(239, 68, 68, 0.2)"
      stroke={selected ? "#dc2626" : "#f87171"}
      strokeWidth={selected ? 3 : 1}
      dash={[8, 4]}
      opacity={opacity}
      listening={listening}
      onClick={listening ? onSelect : undefined}
    />
  );
}

export { generateId };

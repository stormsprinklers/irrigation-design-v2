"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Image as KonvaImage, Group, Rect } from "react-konva";
import type Konva from "konva";
import { useDesignStore } from "@/lib/stores/design-store";
import { distanceBetweenPoints, generateId, POLYGON_CLOSE_RADIUS } from "@/lib/utils";
import type { HydrozonePolygon, ExclusionZone, Point, CatalogItemData } from "@/lib/domain/types";
import { InteractiveHeadGraphic } from "@/components/heads/InteractiveHeadGraphic";
import { getNozzleAdjustability } from "@/lib/catalog/adjustability";
import { pixelsPerFootFromDocument } from "@/lib/domain/design/head-editing";
import { useCanvasSurface } from "@/lib/hooks/use-canvas-theme";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

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
  catalog: CatalogItemData[];
  onCanvasClick: (point: Point) => void;
};

export function DesignCanvas({ imageUrl, catalog, onCanvasClick }: Props) {
  const isMobile = useIsMobile();
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastResetRef = useRef(0);
  const hasInitialCenteredRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<Point | null>(null);
  const panMovedRef = useRef(false);
  const activePointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{
    initialDistance: number;
    initialZoom: number;
    initialPosition: Point;
    center: Point;
  } | null>(null);
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null);
  const {
    document,
    activeTool,
    activeZoneId,
    drawingVertices,
    scalePointA,
    scalePointB,
    selectedId,
    selectedType,
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
    zoomIn,
    zoomOut,
    resetCanvasView,
    patchSelectedHead,
    moveSelectedHead,
  } = useDesignStore();
  const canvasSurface = useCanvasSurface();

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

    if (canvasViewResetAt !== lastResetRef.current) {
      lastResetRef.current = canvasViewResetAt;
      hasInitialCenteredRef.current = true;
      centerCanvasView();
      return;
    }

    if (!hasInitialCenteredRef.current) {
      hasInitialCenteredRef.current = true;
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

  useEffect(() => {
    isPanningRef.current = false;
    lastPanPointRef.current = null;
    panMovedRef.current = false;
  }, [activeTool]);

  function isDimmed(zoneId?: string) {
    return activeZoneId !== null && zoneId !== activeZoneId;
  }

  function clientToCanvas(clientX: number, clientY: number): Point | null {
    const container = containerRef.current;
    const layer = layerRef.current;
    if (!container || !layer) return null;

    const rect = container.getBoundingClientRect();
    const stageX = clientX - rect.left;
    const stageY = clientY - rect.top;
    const transform = layer.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point({ x: stageX, y: stageY });
  }

  const isPlacementTool =
    isDrawingPolygon ||
    activeTool === "scale" ||
    activeTool === "head" ||
    activeTool === "pipe";

  function pointerDistance(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pointerCenter(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function zoomAtScreenPoint(screenPoint: Point, newScale: number) {
    const oldScale = canvasZoom;
    const clampedScale = Math.round(Math.min(4, Math.max(0.25, newScale)) * 100) / 100;
    const mousePointTo = {
      x: (screenPoint.x - stagePosition.x) / oldScale,
      y: (screenPoint.y - stagePosition.y) / oldScale,
    };
    setCanvasView(clampedScale, {
      x: screenPoint.x - mousePointTo.x * clampedScale,
      y: screenPoint.y - mousePointTo.y * clampedScale,
    });
  }

  function updatePinchZoom() {
    const pointers = [...activePointersRef.current.values()];
    if (pointers.length !== 2 || !pinchRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const center = pointerCenter(pointers[0], pointers[1]);
    const screenCenter = { x: center.x - rect.left, y: center.y - rect.top };
    const distance = pointerDistance(pointers[0], pointers[1]);
    const scaleFactor = distance / pinchRef.current.initialDistance;
    zoomAtScreenPoint(screenCenter, pinchRef.current.initialZoom * scaleFactor);
  }

  function handleContainerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2) {
      const pointers = [...activePointersRef.current.values()];
      const distance = pointerDistance(pointers[0], pointers[1]);
      const { canvasZoom: zoom, stagePosition: pos } = useDesignStore.getState();
      pinchRef.current = {
        initialDistance: distance,
        initialZoom: zoom,
        initialPosition: pos,
        center: pointerCenter(pointers[0], pointers[1]),
      };
      isPanningRef.current = false;
      e.preventDefault();
      return;
    }

    if (activeTool === "pan") {
      isPanningRef.current = true;
      panMovedRef.current = false;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (!isPlacementTool) return;

    const pos = clientToCanvas(e.clientX, e.clientY);
    if (!pos) return;
    onCanvasClick(pos);
  }

  function handleContainerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointersRef.current.size === 2 && pinchRef.current) {
      updatePinchZoom();
      e.preventDefault();
      return;
    }

    if (activeTool === "pan" && isPanningRef.current && lastPanPointRef.current) {
      const dx = e.clientX - lastPanPointRef.current.x;
      const dy = e.clientY - lastPanPointRef.current.y;
      if (dx !== 0 || dy !== 0) panMovedRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      const { canvasZoom: zoom, stagePosition: pos } = useDesignStore.getState();
      setCanvasView(zoom, { x: pos.x + dx, y: pos.y + dy });
      return;
    }

    if (isDrawingPolygon && drawingVertices.length > 0) {
      const pos = clientToCanvas(e.clientX, e.clientY);
      if (pos) setPreviewPoint(pos);
    }
  }

  function handleContainerWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const oldScale = canvasZoom;
    const rect = container.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / oldScale,
      y: (pointer.y - stagePosition.y) / oldScale,
    };

    const direction = e.deltaY > 0 ? -1 : 1;
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

  function handlePanPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastPanPointRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      window.setTimeout(() => {
        panMovedRef.current = false;
      }, 0);
    }
  }

  function handleHeadDrag(headId: string, x: number, y: number) {
    if (selectedId === headId && selectedType === "head") {
      moveSelectedHead({ x, y });
      return;
    }
    const heads = document.heads.map((h) =>
      h.id === headId && !h.locked ? { ...h, position: { x, y } } : h
    );
    setDocument({ ...document, heads });
  }

  const ppf = pixelsPerFootFromDocument(document);
  const headEditable = activeTool === "select";

  const previewPolygonPoints =
    previewPoint && drawingVertices.length >= 2
      ? [...drawingVertices, previewPoint]
      : null;

  const stageWidth = Math.max(viewportSize.width, 1);
  const stageHeight = Math.max(viewportSize.height, 1);
  const isPanTool = activeTool === "pan";
  const passThroughPointer = activeTool !== "select";
  const headRadius = isMobile ? 8 : 6;
  const headHitStroke = isMobile ? 16 : 8;
  const needsTouchActionNone = isPanTool || isPlacementTool || isMobile;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-muted/30"
      style={{
        cursor: isDrawingPolygon
          ? "crosshair"
          : isPanTool
            ? isPanningRef.current
              ? "grabbing"
              : "grab"
            : undefined,
        touchAction: needsTouchActionNone ? "none" : undefined,
      }}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handlePanPointerUp}
      onPointerCancel={handlePanPointerUp}
      onWheel={handleContainerWheel}
      onPointerLeave={() => {
        isPanningRef.current = false;
        lastPanPointRef.current = null;
        setPreviewPoint(null);
      }}
    >
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        style={{ pointerEvents: isPlacementTool || isPanTool ? "none" : "auto" }}
      >
        <Layer
          ref={layerRef}
          x={stagePosition.x}
          y={stagePosition.y}
          scaleX={canvasZoom}
          scaleY={canvasZoom}
        >
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            listening={false}
          />
          {bgImage && (
            <KonvaImage image={bgImage} width={width} height={height} listening={false} />
          )}
          {!bgImage && (
            <Line
              points={[0, 0, width, 0, width, height, 0, height]}
              closed
              fill={canvasSurface.fill}
              stroke={canvasSurface.stroke}
              listening={false}
            />
          )}

          {document.exclusionZones.map((zone) => (
            <ExclusionShape
              key={zone.id}
              zone={zone}
              opacity={isDimmed() ? 0.2 : 0.6}
              selected={selectedId === zone.id}
              listening={!passThroughPointer}
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
              listening={!passThroughPointer}
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
              listening={!passThroughPointer}
              onClick={() => setSelected(pipe.id, "pipe")}
              onTap={() => setSelected(pipe.id, "pipe")}
            />
          ))}

          {document.heads.map((head) => {
            const dimmed = isDimmed(head.zoneId);
            const showArc = !activeZoneId || activeZoneId === head.zoneId;
            const nozzle = catalog.find((c) => c.id === head.catalogItemId);
            const selected = selectedId === head.id;
            const showHandles = headEditable && selected && !head.locked && !passThroughPointer;

            return (
              <InteractiveHeadGraphic
                key={head.id}
                centerX={head.position.x}
                centerY={head.position.y}
                pxPerFt={ppf}
                head={head}
                ghost={false}
                showArc={showArc}
                editable={headEditable && !passThroughPointer}
                selected={selected}
                locked={head.locked}
                showAdjustHandles={showHandles}
                listening={!passThroughPointer}
                adjustability={nozzle ? getNozzleAdjustability(nozzle) : null}
                coverageFill={dimmed ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.15)"}
                nozzle={nozzle}
                headMarkerRadius={headRadius}
                headHitStrokeWidth={headHitStroke}
                onSelect={() => setSelected(head.id, "head")}
                onMove={(position) => {
                  if (head.locked) return;
                  if (selected) {
                    moveSelectedHead(position);
                  } else {
                    handleHeadDrag(head.id, position.x, position.y);
                  }
                }}
                onPatch={(patch) => {
                  if (head.locked) return;
                  setSelected(head.id, "head");
                  patchSelectedHead(catalog, patch);
                }}
                onInteractionEnd={() => {}}
              />
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
              listening={!passThroughPointer}
              onClick={() => setSelected(valve.id, "valve")}
              onTap={() => setSelected(valve.id, "valve")}
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
              listening={!passThroughPointer}
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
                        listening={false}
                      />
                    )}
                    <Circle
                      x={vertex.x}
                      y={vertex.y}
                      radius={isFirst && canClose ? 7 : 5}
                      fill={isFirst ? drawStyle.firstVertex : drawStyle.vertex}
                      stroke="#ffffff"
                      strokeWidth={2}
                      listening={false}
                    />
                  </Group>
                );
              })}
            </>
          )}

          {scalePointA && (
            <Circle
              x={scalePointA.x}
              y={scalePointA.y}
              radius={5}
              fill="#ea580c"
              listening={!passThroughPointer}
            />
          )}
          {scalePointB && (
            <Circle
              x={scalePointB.x}
              y={scalePointB.y}
              radius={5}
              fill="#ea580c"
              listening={!passThroughPointer}
            />
          )}
          {scalePointA && scalePointB && (
            <Line
              points={[scalePointA.x, scalePointA.y, scalePointB.x, scalePointB.y]}
              stroke="#ea580c"
              strokeWidth={2}
              listening={!passThroughPointer}
            />
          )}
        </Layer>
      </Stage>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border bg-card/95 px-2 py-1 text-xs text-muted-foreground shadow-sm">
        {Math.round(canvasZoom * 100)}%
      </div>
      {isMobile && (
        <div className="pointer-events-auto absolute bottom-3 left-3 flex gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-11 bg-card/95 shadow-sm"
            aria-label="Zoom out"
            onClick={zoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-11 bg-card/95 shadow-sm"
            aria-label="Fit to view"
            onClick={resetCanvasView}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-11 bg-card/95 shadow-sm"
            aria-label="Zoom in"
            onClick={zoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      )}
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
      onTap={listening ? onSelect : undefined}
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
      onTap={listening ? onSelect : undefined}
    />
  );
}

export { generateId };

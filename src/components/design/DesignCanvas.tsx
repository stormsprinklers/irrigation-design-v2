"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Image as KonvaImage, Group, Rect } from "react-konva";
import type Konva from "konva";
import { useDesignStore } from "@/lib/stores/design-store";
import { distanceBetweenPoints, generateId, POLYGON_CLOSE_RADIUS } from "@/lib/utils";
import type {
  HydrozonePolygon,
  ExclusionZone,
  SiteFeaturePolygon,
  LandscapeArea,
  EquipmentPlacement,
  EquipmentType,
  Point,
  CatalogItemData,
} from "@/lib/domain/types";
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

const POLYGON_DRAW_STYLES: Record<string, { stroke: string; fill: string; vertex: string; firstVertex: string }> = {
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
  siteFeature: {
    stroke: "#b45309",
    fill: "rgba(245, 158, 11, 0.2)",
    vertex: "#f59e0b",
    firstVertex: "#b45309",
  },
  sod: {
    stroke: "#15803d",
    fill: "rgba(74, 222, 128, 0.35)",
    vertex: "#4ade80",
    firstVertex: "#15803d",
  },
  topsoil: {
    stroke: "#78350f",
    fill: "rgba(180, 83, 9, 0.25)",
    vertex: "#d97706",
    firstVertex: "#78350f",
  },
};

const SITE_FEATURE_FILL: Record<string, string> = {
  SLOPE: "rgba(245, 158, 11, 0.25)",
  FENCE: "rgba(120, 113, 108, 0.3)",
  RETAINING_WALL: "rgba(87, 83, 78, 0.35)",
  CONCRETE: "rgba(148, 163, 184, 0.4)",
};

const EQUIPMENT_COLORS: Record<EquipmentType, string> = {
  POC: "#7c3aed",
  BACKFLOW: "#2563eb",
  FILTER: "#0891b2",
  PRESSURE_REGULATOR: "#ca8a04",
  FLOW_SENSOR: "#059669",
  WEATHER_SENSOR: "#4f46e5",
  CONTROLLER: "#9333ea",
};

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
    canvasZoom,
    stagePosition,
    viewportSize,
    canvasViewResetAt,
    setSelected,
    clearSelection,
    setDocument,
    setCanvasView,
    setViewportSize,
    setContentSize,
    centerCanvasView,
    zoomIn,
    zoomOut,
    resetCanvasView,
    editHead,
    moveHeadById,
    setHeadCanvasInteracting,
    setLastCanvasClick,
    showPipes,
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

  const isDrawingPolygon =
    activeTool === "hydrozone" ||
    activeTool === "exclusion" ||
    activeTool === "siteFeature" ||
    activeTool === "sod" ||
    activeTool === "topsoil";
  const drawStyle = isDrawingPolygon ? POLYGON_DRAW_STYLES[activeTool] : null;
  const isHeadEditTool = activeTool === "select" || activeTool === "head";
  const blockStagePointer =
    activeTool === "pan" || isDrawingPolygon || activeTool === "scale" || activeTool === "pipe";
  const passThroughPointer = !isHeadEditTool;

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
    activeTool === "pipe" ||
    activeTool === "valve" ||
    activeTool === "equipment";

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

    // Head placement uses the Konva stage handler so clicks on existing heads are not treated as new placements.
    if (activeTool === "head") return;

    const pos = clientToCanvas(e.clientX, e.clientY);
    if (!pos) return;
    setLastCanvasClick(pos);
    onCanvasClick(pos);
  }

  function canvasPointFromStage(): Point | null {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const transform = layer.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pointer);
  }

  function handleStagePointerDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const target = e.target;
    const stage = target.getStage();
    const isEmptyTarget = target === stage || target.getClassName() === "Layer";

    if (activeTool === "head" && isEmptyTarget) {
      const pos = canvasPointFromStage();
      if (pos) {
        setLastCanvasClick(pos);
        onCanvasClick(pos);
      }
      return;
    }

    if (isHeadEditTool && isEmptyTarget) {
      clearSelection();
    }
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

  function handleHeadMove(headId: string, position: Point) {
    moveHeadById(headId, position);
  }

  const ppf = pixelsPerFootFromDocument(document);
  const headEditable = isHeadEditTool;

  const previewPolygonPoints =
    previewPoint && drawingVertices.length >= 2
      ? [...drawingVertices, previewPoint]
      : null;

  const stageWidth = Math.max(viewportSize.width, 1);
  const stageHeight = Math.max(viewportSize.height, 1);
  const isPanTool = activeTool === "pan";
  const headRadius = isMobile ? 12 : 6;
  const headHitStroke = isMobile ? 28 : 8;
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
        activePointersRef.current.clear();
        pinchRef.current = null;
      }}
    >
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        style={{ pointerEvents: blockStagePointer ? "none" : "auto" }}
        onMouseDown={handleStagePointerDown}
        onTouchStart={handleStagePointerDown}
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

          {(document.landscapeAreas ?? []).map((area) => (
            <LandscapeShape
              key={area.id}
              area={area}
              fill={area.areaType === "SOD" ? "rgba(74, 222, 128, 0.4)" : "rgba(180, 83, 9, 0.3)"}
              selected={selectedId === area.id}
              listening={!passThroughPointer}
              onSelect={() => setSelected(area.id, "landscape")}
            />
          ))}

          {(document.siteFeatures ?? []).map((feature) => (
            <SiteFeatureShape
              key={feature.id}
              feature={feature}
              fill={SITE_FEATURE_FILL[feature.featureType] ?? "rgba(245, 158, 11, 0.25)"}
              selected={selectedId === feature.id}
              listening={!passThroughPointer}
              onSelect={() => setSelected(feature.id, "siteFeature")}
            />
          ))}

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

          {showPipes
            ? document.pipes.map((pipe) => {
            const strokeW = Math.max(5, pipe.diameterInches * 3);
            const points = pipe.points.flatMap((p) => [p.x, p.y]);
            const dimmed = isDimmed(pipe.zoneId);
            return (
              <Group key={pipe.id}>
                <Line
                  points={points}
                  stroke="#ffffff"
                  strokeWidth={strokeW + 3}
                  opacity={dimmed ? 0.15 : 0.85}
                  listening={false}
                />
                <Line
                  points={points}
                  stroke={dimmed ? "#64748b" : "#1d4ed8"}
                  strokeWidth={strokeW}
                  opacity={dimmed ? 0.35 : 1}
                  listening={!passThroughPointer}
                  onClick={() => setSelected(pipe.id, "pipe")}
                  onTap={() => setSelected(pipe.id, "pipe")}
                />
              </Group>
            );
          })
            : null}

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
                  handleHeadMove(head.id, position);
                }}
                onPatch={(patch) => {
                  if (head.locked) return;
                  editHead(head.id, catalog, patch);
                }}
                onInteractionStart={() => setHeadCanvasInteracting(true)}
                onInteractionEnd={() => setHeadCanvasInteracting(false)}
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

          {(document.equipment ?? []).map((equip) => (
            <EquipmentMarker
              key={equip.id}
              equip={equip}
              color={EQUIPMENT_COLORS[equip.equipmentType]}
              opacity={isDimmed(equip.zoneId) ? 0.25 : 1}
              selected={selectedId === equip.id}
              listening={!passThroughPointer}
              onSelect={() => setSelected(equip.id, "equipment")}
            />
          ))}

          {document.waterSource?.poc &&
            !(document.equipment ?? []).some((e) => e.equipmentType === "POC") && (
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

function SiteFeatureShape({
  feature,
  fill,
  selected,
  listening = true,
  onSelect,
}: {
  feature: SiteFeaturePolygon;
  fill: string;
  selected: boolean;
  listening?: boolean;
  onSelect: () => void;
}) {
  return (
    <Line
      points={feature.vertices.flatMap((p) => [p.x, p.y])}
      closed
      fill={fill}
      stroke={selected ? "#b45309" : "#f59e0b"}
      strokeWidth={selected ? 3 : 2}
      listening={listening}
      onClick={listening ? onSelect : undefined}
      onTap={listening ? onSelect : undefined}
    />
  );
}

function LandscapeShape({
  area,
  fill,
  selected,
  listening = true,
  onSelect,
}: {
  area: LandscapeArea;
  fill: string;
  selected: boolean;
  listening?: boolean;
  onSelect: () => void;
}) {
  return (
    <Line
      points={area.vertices.flatMap((p) => [p.x, p.y])}
      closed
      fill={fill}
      stroke={selected ? "#15803d" : area.areaType === "SOD" ? "#22c55e" : "#b45309"}
      strokeWidth={selected ? 3 : 2}
      listening={listening}
      onClick={listening ? onSelect : undefined}
      onTap={listening ? onSelect : undefined}
    />
  );
}

function EquipmentMarker({
  equip,
  color,
  opacity,
  selected,
  listening = true,
  onSelect,
}: {
  equip: EquipmentPlacement;
  color: string;
  opacity: number;
  selected: boolean;
  listening?: boolean;
  onSelect: () => void;
}) {
  return (
    <Group
      x={equip.position.x}
      y={equip.position.y}
      opacity={opacity}
      listening={listening}
      onClick={listening ? onSelect : undefined}
      onTap={listening ? onSelect : undefined}
    >
      <Circle radius={12} fill={color} stroke="#fff" strokeWidth={selected ? 3 : 2} />
      <Circle radius={4} fill="#fff" listening={false} />
    </Group>
  );
}

export { generateId };

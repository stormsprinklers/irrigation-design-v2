"use client";

import { Layer, Line, Rect, Stage } from "react-konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTrainingStore } from "@/lib/stores/training-store";
import { TRAINING_DISPLAY_PX_PER_FT } from "@/lib/domain/training/types";
import { gridColorCells } from "@/lib/domain/simulation/heatmap";
import { samplePointsInPolygonFeet } from "@/lib/domain/simulation/sample-grid";
import { generateId } from "@/lib/utils";
import { getNozzleAdjustability, resolveDefaultHeadSettings } from "@/lib/catalog/adjustability";
import { stripFieldsFromNozzle } from "@/lib/catalog/strip-pattern";
import { getNozzlesForHead, getHeadBodies } from "@/lib/catalog/compat";
import type { TrainingHeadSnapshot } from "@/lib/domain/training/types";
import type Konva from "konva";
import { wedgeStartDeg, wedgeEndDeg } from "@/lib/domain/placement/wedge";
import { trainingStageSizePx } from "@/lib/domain/training/stage-layout";
import { TrainingHeadGraphic } from "./TrainingHeadGraphic";
import { PolygonSideLabels } from "./PolygonSideLabels";

const PX = TRAINING_DISPLAY_PX_PER_FT;

type StageLayout = ReturnType<typeof trainingStageSizePx>;

function stageOffsetInWrapper(
  layout: StageLayout,
  viewport: { width: number; height: number }
): { x: number; y: number } {
  const wrapperW = Math.max(layout.widthPx, viewport.width);
  const wrapperH = Math.max(layout.heightPx, viewport.height);
  return {
    x: (wrapperW - layout.widthPx) / 2,
    y: (wrapperH - layout.heightPx) / 2,
  };
}

/** Keep the viewport center pinned when stage padding/size changes (radius, arc, etc.). */
function preserveViewportScroll(
  el: HTMLDivElement,
  prevLayout: StageLayout,
  nextLayout: StageLayout,
  viewport: { width: number; height: number }
) {
  const prevOff = stageOffsetInWrapper(prevLayout, viewport);
  const vx = el.scrollLeft + el.clientWidth / 2;
  const vy = el.scrollTop + el.clientHeight / 2;
  const pxX = vx - prevOff.x - prevLayout.paddingPx;
  const pxY = vy - prevOff.y - prevLayout.paddingPx;

  const nextOff = stageOffsetInWrapper(nextLayout, viewport);
  const targetX = nextOff.x + nextLayout.paddingPx + pxX;
  const targetY = nextOff.y + nextLayout.paddingPx + pxY;

  el.scrollLeft = Math.max(0, targetX - el.clientWidth / 2);
  el.scrollTop = Math.max(0, targetY - el.clientHeight / 2);
}

function layoutsEqual(a: StageLayout, b: StageLayout): boolean {
  return a.paddingPx === b.paddingPx && a.widthPx === b.widthPx && a.heightPx === b.heightPx;
}

const MARQUEE_MIN_PX = 4;

type MarqueeState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

function isAdditivePointerEvent(e: MouseEvent | TouchEvent): boolean {
  if ("shiftKey" in e) {
    return e.shiftKey || e.metaKey || e.ctrlKey;
  }
  return false;
}

function headsInMarquee(
  heads: TrainingHeadSnapshot[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stagePadding: number,
  pxPerFt: number
): string[] {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  return heads
    .filter((head) => {
      const cx = head.positionFt.x * pxPerFt + stagePadding;
      const cy = head.positionFt.y * pxPerFt + stagePadding;
      return cx >= left && cx <= right && cy >= top && cy <= bottom;
    })
    .map((head) => head.id);
}

function isEmptyStageTarget(target: Konva.Node): boolean {
  const stage = target.getStage();
  return target === stage || target.getClassName() === "Layer";
}

export function TrainingCanvas() {
  const polygon = useTrainingStore((s) => s.polygon);
  const baselineHeads = useTrainingStore((s) => s.baselineHeads);
  const correctedHeads = useTrainingStore((s) => s.correctedHeads);
  const viewMode = useTrainingStore((s) => s.viewMode);
  const showHeatmap = useTrainingStore((s) => s.showHeatmap);
  const showSampleGrid = useTrainingStore((s) => s.showSampleGrid);
  const showArcs = useTrainingStore((s) => s.showArcs);
  const selectedHeadIds = useTrainingStore((s) => s.selectedHeadIds);
  const tool = useTrainingStore((s) => s.tool);
  const correctedGrid = useTrainingStore((s) => s.correctedGrid);
  const baselineGrid = useTrainingStore((s) => s.baselineGrid);
  const catalog = useTrainingStore((s) => s.catalog);
  const generatingExample = useTrainingStore((s) => s.generatingExample);
  const selectHead = useTrainingStore((s) => s.selectHead);
  const setSelectedHeadIds = useTrainingStore((s) => s.setSelectedHeadIds);
  const clearSelection = useTrainingStore((s) => s.clearSelection);
  const moveCorrectedHead = useTrainingStore((s) => s.moveCorrectedHead);
  const moveHeadsToPositions = useTrainingStore((s) => s.moveHeadsToPositions);
  const updateCorrectedHead = useTrainingStore((s) => s.updateCorrectedHead);
  const recomputeScores = useTrainingStore((s) => s.recomputeScores);
  const addCorrectedHead = useTrainingStore((s) => s.addCorrectedHead);

  const stageRef = useRef(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollLockCountRef = useRef(0);
  const lastCenteredSeedRef = useRef<number | null>(null);
  const computedLayoutRef = useRef({ paddingPx: 40, widthPx: 800, heightPx: 600 });
  const frozenLayoutRef = useRef<ReturnType<typeof trainingStageSizePx> | null>(null);
  const scrollAnchorRef = useRef({ left: 0, top: 0 });
  const prevLayoutForScrollRef = useRef<StageLayout>({ paddingPx: 40, widthPx: 800, heightPx: 600 });
  const skipLayoutScrollCompensationRef = useRef(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [frozenLayout, setFrozenLayout] = useState<ReturnType<typeof trainingStageSizePx> | null>(
    null
  );
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const marqueeUsedRef = useRef(false);
  const groupDragRef = useRef<{
    anchorId: string;
    starts: Record<string, { x: number; y: number }>;
  } | null>(null);

  const unlockCanvasScroll = useCallback(() => {
    scrollLockCountRef.current = Math.max(0, scrollLockCountRef.current - 1);
    if (scrollLockCountRef.current === 0) {
      const el = containerRef.current;
      const prevLayout = frozenLayoutRef.current ?? computedLayoutRef.current;
      setIsInteracting(false);
      frozenLayoutRef.current = null;
      setFrozenLayout(null);
      if (el) {
        const nextLayout = computedLayoutRef.current;
        requestAnimationFrame(() => {
          if (!layoutsEqual(prevLayout, nextLayout)) {
            preserveViewportScroll(el, prevLayout, nextLayout, size);
          }
          prevLayoutForScrollRef.current = nextLayout;
        });
      }
    }
  }, [size]);

  const lockCanvasScroll = useCallback(() => {
    const el = containerRef.current;
    if (scrollLockCountRef.current === 0 && el) {
      scrollAnchorRef.current = { left: el.scrollLeft, top: el.scrollTop };
      setIsInteracting(true);
      frozenLayoutRef.current = computedLayoutRef.current;
      setFrozenLayout(computedLayoutRef.current);
    }
    scrollLockCountRef.current += 1;
  }, []);

  const forceEndInteraction = useCallback(() => {
    if (scrollLockCountRef.current === 0) return;
    scrollLockCountRef.current = 1;
    unlockCanvasScroll();
  }, [unlockCanvasScroll]);

  useEffect(() => {
    const onPointerUp = () => {
      requestAnimationFrame(() => {
        if (scrollLockCountRef.current > 0) {
          forceEndInteraction();
        }
      });
    };
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [forceEndInteraction]);

  useEffect(() => {
    if (!isInteracting) return;
    const el = containerRef.current;
    if (!el) return;

    const anchor = scrollAnchorRef.current;
    const fixScroll = () => {
      if (el.scrollLeft !== anchor.left || el.scrollTop !== anchor.top) {
        el.scrollLeft = anchor.left;
        el.scrollTop = anchor.top;
      }
    };

    el.addEventListener("scroll", fixScroll, { passive: true });
    return () => el.removeEventListener("scroll", fixScroll);
  }, [isInteracting]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (scrollLockCountRef.current > 0) {
        e.preventDefault();
        return;
      }
      const canScrollX = el.scrollWidth > el.clientWidth;
      const canScrollY = el.scrollHeight > el.clientHeight;
      if (!canScrollX && !canScrollY) return;

      if (canScrollX) el.scrollLeft += e.deltaX;
      if (canScrollY) el.scrollTop += e.deltaY;
      e.preventDefault();
    };

    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", onWheel, { capture: true });
  }, [polygon?.metadata.seed]);

  useEffect(() => {
    if (!isInteracting) return;
    const el = containerRef.current;
    if (!el) return;

    const blockTouchScroll = (e: TouchEvent) => {
      e.preventDefault();
    };

    el.addEventListener("touchmove", blockTouchScroll, { passive: false });
    return () => el.removeEventListener("touchmove", blockTouchScroll);
  }, [isInteracting]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      setSize((prev) => {
        const width = el.clientWidth;
        const height = el.clientHeight;
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [polygon?.metadata.seed]);

  useEffect(() => {
    if (!polygon) return;
    const seed = polygon.metadata.seed;
    if (lastCenteredSeedRef.current === seed) return;
    lastCenteredSeedRef.current = seed;
    skipLayoutScrollCompensationRef.current = true;

    const el = containerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
      prevLayoutForScrollRef.current = computedLayoutRef.current;
      skipLayoutScrollCompensationRef.current = false;
    });
  }, [polygon?.metadata.seed]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !polygon || isInteracting) return;
    if (skipLayoutScrollCompensationRef.current) return;

    const prev = prevLayoutForScrollRef.current;
    const next = computedLayoutRef.current;
    if (layoutsEqual(prev, next)) return;

    requestAnimationFrame(() => {
      preserveViewportScroll(el, prev, next, size);
      prevLayoutForScrollRef.current = next;
    });
  }, [correctedHeads, baselineHeads, viewMode, polygon, isInteracting, size]);

  const widthFt = polygon?.metadata.widthFt ?? 0;
  const heightFt = polygon?.metadata.heightFt ?? 0;

  const headsForBounds =
    viewMode === "compare"
      ? [...baselineHeads, ...correctedHeads]
      : viewMode === "baseline"
        ? baselineHeads
        : correctedHeads;

  const stageLayout = polygon
    ? trainingStageSizePx(widthFt, heightFt, headsForBounds, PX)
    : { paddingPx: 40, widthPx: 800, heightPx: 600 };
  computedLayoutRef.current = stageLayout;
  const activeLayout = frozenLayout ?? stageLayout;

  const stagePadding = activeLayout.paddingPx;
  const contentW = activeLayout.widthPx;
  const contentH = activeLayout.heightPx;
  const wrapperW = Math.max(contentW, size.width);
  const wrapperH = Math.max(contentH, size.height);

  if (!polygon) {
    return (
      <div
        ref={containerRef}
        className="flex h-full min-h-0 items-center justify-center text-muted-foreground"
      >
        {generatingExample ? "Generating lawn…" : "Click Generate to create a training example"}
      </div>
    );
  }

  const displayHeads =
    viewMode === "baseline"
      ? baselineHeads
      : viewMode === "compare"
        ? correctedHeads
        : correctedHeads;

  const ghostHeads = viewMode === "compare" ? baselineHeads : [];
  const editable = tool === "select" && viewMode !== "baseline";

  const grid = viewMode === "baseline" ? baselineGrid : correctedGrid;
  const heatCells = showHeatmap && grid ? gridColorCells(grid, PX) : [];
  const samplePts = showSampleGrid
    ? samplePointsInPolygonFeet(polygon.verticesFt, 1.5)
    : [];

  const flatVertices = polygon.verticesFt.flatMap((v) => [v.x * PX, v.y * PX]);

  function finishMarqueeSelection(
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
    additive: boolean
  ) {
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    if (width < MARQUEE_MIN_PX && height < MARQUEE_MIN_PX) return;

    marqueeUsedRef.current = true;
    const ids = headsInMarquee(
      correctedHeads,
      startX,
      startY,
      currentX,
      currentY,
      stagePadding,
      PX
    );
    if (additive) {
      const merged = new Set([...selectedHeadIds, ...ids]);
      setSelectedHeadIds([...merged]);
    } else {
      setSelectedHeadIds(ids);
    }
  }

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (tool !== "select" || viewMode === "baseline") return;
    if (!isEmptyStageTarget(e.target)) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    marqueeUsedRef.current = false;
    setMarquee({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!marquee) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    setMarquee((current) =>
      current ? { ...current, currentX: pos.x, currentY: pos.y } : null
    );
  }

  function handleStageMouseUp(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!marquee) return;
    const { startX, startY, currentX, currentY } = marquee;
    setMarquee(null);
    finishMarqueeSelection(
      startX,
      startY,
      currentX,
      currentY,
      isAdditivePointerEvent(e.evt)
    );
  }

  function handleStageClick(e: {
    target: {
      getStage?: () => { getPointerPosition?: () => { x: number; y: number } | null } | null;
      getClassName?: () => string;
    };
  }) {
    const stage = e.target.getStage?.();
    if (!stage) return;
    const clickedEmpty =
      e.target === stage || e.target.getClassName?.() === "Layer";
    if (!clickedEmpty) return;

    if (tool === "select") {
      if (!marqueeUsedRef.current) {
        clearSelection();
      }
      marqueeUsedRef.current = false;
      return;
    }

    if (tool !== "add") return;
    const pos = stage.getPointerPosition?.();
    if (!pos) return;
    const feet = { x: (pos.x - stagePadding) / PX, y: (pos.y - stagePadding) / PX };
    const body = getHeadBodies(catalog)[0];
    if (!body) return;
    const nozzle = getNozzlesForHead(catalog, body.id)[0];
    if (!nozzle) return;
    const settings = resolveDefaultHeadSettings(nozzle, 65);
    const wedgeHead = {
      position: feet,
      arcDegrees: settings.arcDegrees,
      radiusFeet: settings.radiusFeet,
      rotationDegrees: settings.rotationDegrees,
    };
    const snap: TrainingHeadSnapshot = {
      id: generateId("head"),
      positionFt: feet,
      radiusFeet: settings.radiusFeet,
      arcDegrees: settings.arcDegrees,
      rotationDegrees: settings.rotationDegrees,
      wedgeStartDeg: wedgeStartDeg(wedgeHead),
      wedgeEndDeg: wedgeEndDeg(wedgeHead),
      catalogItemId: nozzle.id,
      headBodyId: body.id,
      nozzleModel: nozzle.model,
      gpm: settings.gpm,
      precipInPerHr: settings.precipInPerHr,
      ...stripFieldsFromNozzle(nozzle),
    };
    addCorrectedHead(snap);
  }

  return (
    <div
      ref={containerRef}
      className={`scroll-surface h-full min-h-0 w-full bg-muted/30 ${
        isInteracting ? "overflow-hidden touch-none" : "overflow-auto"
      }`}
      style={{
        overscrollBehavior: "contain",
        touchAction: isInteracting ? "none" : "pan-x pan-y",
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{ width: wrapperW, height: wrapperH, minWidth: wrapperW, minHeight: wrapperH }}
      >
        <Stage
          ref={stageRef}
          width={contentW}
          height={contentH}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          <Layer>
          {heatCells.map((cell, i) => (
            <Rect
              key={`h-${i}`}
              x={cell.x + stagePadding}
              y={cell.y + stagePadding}
              width={cell.width}
              height={cell.height}
              fill={`rgba(${cell.color.r},${cell.color.g},${cell.color.b},${cell.color.a})`}
              listening={false}
            />
          ))}
          {showSampleGrid &&
            samplePts.map((p, i) => (
              <Rect
                key={`s-${i}`}
                x={p.x * PX + stagePadding - 2}
                y={p.y * PX + stagePadding - 2}
                width={4}
                height={4}
                fill="rgba(100,100,100,0.4)"
                listening={false}
              />
            ))}
          {polygon.exclusionZonesFt.map((zone) => (
            <Line
              key={zone.id}
              points={zone.vertices.flatMap((v) => [
                v.x * PX + stagePadding,
                v.y * PX + stagePadding,
              ])}
              closed
              fill="rgba(239, 68, 68, 0.2)"
              stroke="#f87171"
              strokeWidth={1}
              dash={[8, 4]}
              listening={false}
            />
          ))}
          <Line
            points={flatVertices.map((v) => v + stagePadding)}
            closed
            stroke="#16a34a"
            strokeWidth={2}
            fill="rgba(34,197,94,0.08)"
            listening={false}
          />
          <PolygonSideLabels
            verticesFt={polygon.verticesFt}
            pxPerFt={PX}
            stageOffset={stagePadding}
          />
          {ghostHeads.map((head) => {
            const nozzle = catalog.find((c) => c.id === head.catalogItemId);
            return (
              <TrainingHeadGraphic
                key={`ghost-${head.id}`}
                head={head}
                stageOffset={stagePadding}
                ghost
                showArc={showArcs}
                editable={false}
                selected={false}
                showAdjustHandles={false}
                adjustability={nozzle ? getNozzleAdjustability(nozzle) : null}
                stripPattern={head.stripPattern}
                patternWidthFt={head.patternWidthFt}
                patternLengthFt={head.patternLengthFt}
                onSelect={() => {}}
                onMove={() => {}}
                onPatch={() => {}}
                onInteractionEnd={() => {}}
              />
            );
          })}
          {displayHeads.map((head) => {
            const nozzle = catalog.find((c) => c.id === head.catalogItemId);
            return (
              <TrainingHeadGraphic
                key={head.id}
                head={head}
                stageOffset={stagePadding}
                ghost={false}
                showArc={showArcs}
                editable={editable}
                selected={selectedHeadIds.includes(head.id)}
                showAdjustHandles={
                  editable && selectedHeadIds.length === 1 && selectedHeadIds[0] === head.id
                }
                adjustability={nozzle ? getNozzleAdjustability(nozzle) : null}
                stripPattern={head.stripPattern}
                patternWidthFt={head.patternWidthFt}
                patternLengthFt={head.patternLengthFt}
                onSelect={(e) => {
                  selectHead(head.id, { additive: isAdditivePointerEvent(e.evt) });
                }}
                onDragStart={() => {
                  if (
                    editable &&
                    selectedHeadIds.length > 1 &&
                    selectedHeadIds.includes(head.id)
                  ) {
                    groupDragRef.current = {
                      anchorId: head.id,
                      starts: Object.fromEntries(
                        correctedHeads
                          .filter((h) => selectedHeadIds.includes(h.id))
                          .map((h) => [h.id, { ...h.positionFt }])
                      ),
                    };
                  } else {
                    groupDragRef.current = null;
                  }
                }}
                onMove={(positionFt, opts) => {
                  const drag = groupDragRef.current;
                  if (drag && drag.anchorId === head.id && drag.starts[head.id]) {
                    const start = drag.starts[head.id]!;
                    const dx = positionFt.x - start.x;
                    const dy = positionFt.y - start.y;
                    const positions: Record<string, { x: number; y: number }> = {};
                    for (const [id, pos] of Object.entries(drag.starts)) {
                      positions[id] = { x: pos.x + dx, y: pos.y + dy };
                    }
                    moveHeadsToPositions(positions, opts);
                    return;
                  }
                  moveCorrectedHead(head.id, positionFt, opts);
                }}
                onPatch={(patch, opts) => updateCorrectedHead(head.id, patch, opts)}
                onInteractionStart={lockCanvasScroll}
                onDragEnd={() => {
                  groupDragRef.current = null;
                }}
                onInteractionEnd={() => {
                  groupDragRef.current = null;
                  unlockCanvasScroll();
                  recomputeScores();
                }}
              />
            );
          })}
          {marquee && (
            <Rect
              x={Math.min(marquee.startX, marquee.currentX)}
              y={Math.min(marquee.startY, marquee.currentY)}
              width={Math.abs(marquee.currentX - marquee.startX)}
              height={Math.abs(marquee.currentY - marquee.startY)}
              fill="rgba(37, 99, 235, 0.12)"
              stroke="#2563eb"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

"use client";

import { Layer, Line, Rect, Stage } from "react-konva";
import { useEffect, useRef, useState } from "react";
import { useTrainingStore } from "@/lib/stores/training-store";
import { TRAINING_DISPLAY_PX_PER_FT } from "@/lib/domain/training/types";
import { gridColorCells } from "@/lib/domain/simulation/heatmap";
import { samplePointsInPolygonFeet } from "@/lib/domain/simulation/sample-grid";
import { generateId } from "@/lib/utils";
import { getNozzleAdjustability, resolveDefaultHeadSettings } from "@/lib/catalog/adjustability";
import { stripFieldsFromNozzle } from "@/lib/catalog/strip-pattern";
import { getNozzlesForHead, getHeadBodies } from "@/lib/catalog/compat";
import type { TrainingHeadSnapshot } from "@/lib/domain/training/types";
import { wedgeStartDeg, wedgeEndDeg } from "@/lib/domain/placement/wedge";
import { TrainingHeadGraphic } from "./TrainingHeadGraphic";
import { PolygonSideLabels } from "./PolygonSideLabels";

const PX = TRAINING_DISPLAY_PX_PER_FT;
const STAGE_OFFSET = 40;

export function TrainingCanvas() {
  const polygon = useTrainingStore((s) => s.polygon);
  const baselineHeads = useTrainingStore((s) => s.baselineHeads);
  const correctedHeads = useTrainingStore((s) => s.correctedHeads);
  const viewMode = useTrainingStore((s) => s.viewMode);
  const showHeatmap = useTrainingStore((s) => s.showHeatmap);
  const showSampleGrid = useTrainingStore((s) => s.showSampleGrid);
  const showArcs = useTrainingStore((s) => s.showArcs);
  const selectedHeadId = useTrainingStore((s) => s.selectedHeadId);
  const tool = useTrainingStore((s) => s.tool);
  const correctedGrid = useTrainingStore((s) => s.correctedGrid);
  const baselineGrid = useTrainingStore((s) => s.baselineGrid);
  const catalog = useTrainingStore((s) => s.catalog);
  const setSelectedHeadId = useTrainingStore((s) => s.setSelectedHeadId);
  const moveCorrectedHead = useTrainingStore((s) => s.moveCorrectedHead);
  const updateCorrectedHead = useTrainingStore((s) => s.updateCorrectedHead);
  const recomputeScores = useTrainingStore((s) => s.recomputeScores);
  const addCorrectedHead = useTrainingStore((s) => s.addCorrectedHead);

  const stageRef = useRef(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

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

  const widthFt = polygon?.metadata.widthFt ?? 0;
  const heightFt = polygon?.metadata.heightFt ?? 0;
  const contentW = widthFt * PX + STAGE_OFFSET * 2;
  const contentH = heightFt * PX + STAGE_OFFSET * 2;
  const wrapperW = Math.max(contentW, size.width);
  const wrapperH = Math.max(contentH, size.height);

  useEffect(() => {
    if (!polygon) return;
    const el = containerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
    });
  }, [polygon, wrapperW, wrapperH, size.width, size.height]);

  if (!polygon) {
    return (
      <div
        ref={containerRef}
        className="flex h-full items-center justify-center text-muted-foreground"
      >
        Click Generate to create a training example
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
      setSelectedHeadId(null);
      return;
    }

    if (tool !== "add") return;
    const pos = stage.getPointerPosition?.();
    if (!pos) return;
    const feet = { x: (pos.x - STAGE_OFFSET) / PX, y: (pos.y - STAGE_OFFSET) / PX };
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
    <div ref={containerRef} className="scroll-surface h-full w-full overflow-auto bg-muted/30">
      <div
        className="flex items-center justify-center"
        style={{ width: wrapperW, height: wrapperH, minWidth: wrapperW, minHeight: wrapperH }}
      >
        <Stage
          ref={stageRef}
          width={contentW}
          height={contentH}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          <Layer>
          {heatCells.map((cell, i) => (
            <Rect
              key={`h-${i}`}
              x={cell.x + STAGE_OFFSET}
              y={cell.y + STAGE_OFFSET}
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
                x={p.x * PX + STAGE_OFFSET - 2}
                y={p.y * PX + STAGE_OFFSET - 2}
                width={4}
                height={4}
                fill="rgba(100,100,100,0.4)"
                listening={false}
              />
            ))}
          <Line
            points={flatVertices.map((v) => v + STAGE_OFFSET)}
            closed
            stroke="#16a34a"
            strokeWidth={2}
            fill="rgba(34,197,94,0.08)"
            listening={false}
          />
          <PolygonSideLabels
            verticesFt={polygon.verticesFt}
            pxPerFt={PX}
            stageOffset={STAGE_OFFSET}
          />
          {ghostHeads.map((head) => {
            const nozzle = catalog.find((c) => c.id === head.catalogItemId);
            return (
              <TrainingHeadGraphic
                key={`ghost-${head.id}`}
                head={head}
                stageOffset={STAGE_OFFSET}
                ghost
                showArc={showArcs}
                editable={false}
                selected={false}
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
                stageOffset={STAGE_OFFSET}
                ghost={false}
                showArc={showArcs}
                editable={editable}
                selected={selectedHeadId === head.id}
                adjustability={nozzle ? getNozzleAdjustability(nozzle) : null}
                stripPattern={head.stripPattern}
                patternWidthFt={head.patternWidthFt}
                patternLengthFt={head.patternLengthFt}
                onSelect={() => setSelectedHeadId(head.id)}
                onMove={(positionFt, opts) => moveCorrectedHead(head.id, positionFt, opts)}
                onPatch={(patch, opts) => updateCorrectedHead(head.id, patch, opts)}
                onInteractionEnd={() => recomputeScores()}
              />
            );
          })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

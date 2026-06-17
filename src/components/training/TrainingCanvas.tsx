"use client";

import { Layer, Line, Rect, Stage, Circle, Arc, Group } from "react-konva";
import { useEffect, useRef, useState } from "react";
import { useTrainingStore } from "@/lib/stores/training-store";
import { TRAINING_DISPLAY_PX_PER_FT } from "@/lib/domain/training/types";
import { gridColorCells } from "@/lib/domain/simulation/heatmap";
import { samplePointsInPolygonFeet } from "@/lib/domain/simulation/sample-grid";
import { generateId } from "@/lib/utils";
import { resolveDefaultHeadSettings } from "@/lib/catalog/adjustability";
import { getNozzlesForHead, getHeadBodies } from "@/lib/catalog/compat";
import type { TrainingHeadSnapshot } from "@/lib/domain/training/types";
import { wedgeStartDeg, wedgeEndDeg } from "@/lib/domain/placement/wedge";

const PX = TRAINING_DISPLAY_PX_PER_FT;

function toPx(p: { x: number; y: number }) {
  return { x: p.x * PX, y: p.y * PX };
}

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

  if (!polygon) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
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

  const grid = viewMode === "baseline" ? baselineGrid : correctedGrid;
  const heatCells = showHeatmap && grid ? gridColorCells(grid, PX) : [];
  const samplePts = showSampleGrid
    ? samplePointsInPolygonFeet(polygon.verticesFt, 1.5)
    : [];

  const flatVertices = polygon.verticesFt.flatMap((v) => [v.x * PX, v.y * PX]);

  const widthFt = polygon.metadata.widthFt;
  const heightFt = polygon.metadata.heightFt;
  const stageW = Math.max(widthFt * PX + 80, size.width);
  const stageH = Math.max(heightFt * PX + 80, size.height);

  function handleStageClick(e: { target: { getStage?: () => { getPointerPosition?: () => { x: number; y: number } | null } | null } }) {
    if (tool !== "add") return;
    const stage = e.target.getStage?.();
    const pos = stage?.getPointerPosition?.();
    if (!pos) return;
    const feet = { x: pos.x / PX, y: pos.y / PX };
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
    };
    addCorrectedHead(snap);
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto bg-muted/30"
    >
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer>
          {heatCells.map((cell, i) => (
            <Rect
              key={`h-${i}`}
              x={cell.x + 40}
              y={cell.y + 40}
              width={cell.width}
              height={cell.height}
              fill={`rgba(${cell.color.r},${cell.color.g},${cell.color.b},${cell.color.a})`}
              listening={false}
            />
          ))}
          {showSampleGrid &&
            samplePts.map((p, i) => (
              <Circle
                key={`s-${i}`}
                x={p.x * PX + 40}
                y={p.y * PX + 40}
                radius={2}
                fill="rgba(100,100,100,0.4)"
                listening={false}
              />
            ))}
          <Line
            points={flatVertices.map((v, i) => (i % 2 === 0 ? v + 40 : v + 40))}
            closed
            stroke="#16a34a"
            strokeWidth={2}
            fill="rgba(34,197,94,0.08)"
            listening={false}
          />
          {ghostHeads.map((head) => (
            <HeadGraphic
              key={`ghost-${head.id}`}
              head={head}
              offset={40}
              ghost
              showArc={showArcs}
              draggable={false}
              selected={false}
              onSelect={() => {}}
              onDragEnd={() => {}}
            />
          ))}
          {displayHeads.map((head) => (
            <HeadGraphic
              key={head.id}
              head={head}
              offset={40}
              ghost={false}
              showArc={showArcs}
              draggable={tool === "select" && viewMode !== "baseline"}
              selected={selectedHeadId === head.id}
              onSelect={() => setSelectedHeadId(head.id)}
              onDragEnd={(x, y) => moveCorrectedHead(head.id, { x: (x - 40) / PX, y: (y - 40) / PX })}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

function HeadGraphic({
  head,
  offset,
  ghost,
  showArc,
  draggable,
  selected,
  onSelect,
  onDragEnd,
}: {
  head: TrainingHeadSnapshot;
  offset: number;
  ghost: boolean;
  showArc: boolean;
  draggable: boolean;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const p = toPx(head.positionFt);
  const x = p.x + offset;
  const y = p.y + offset;
  const radiusPx = head.radiusFeet * PX;

  return (
    <Group>
      {showArc && (
        <Arc
          x={x}
          y={y}
          innerRadius={0}
          outerRadius={radiusPx}
          angle={head.arcDegrees}
          rotation={head.rotationDegrees - head.arcDegrees / 2}
          fill={ghost ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.18)"}
          listening={false}
        />
      )}
      <Circle
        x={x}
        y={y}
        radius={selected ? 8 : 6}
        fill={ghost ? "#94a3b8" : selected ? "#2563eb" : "#1d4ed8"}
        draggable={draggable}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      />
    </Group>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Image as KonvaImage, Arc, Group } from "react-konva";
import type Konva from "konva";
import { useDesignStore } from "@/lib/stores/design-store";
import { generateId } from "@/lib/utils";
import type { HydrozonePolygon, ExclusionZone, Point } from "@/lib/domain/types";

const HYDROZONE_COLORS: Record<string, string> = {
  TURF: "rgba(34, 197, 94, 0.25)",
  SHRUBS: "rgba(132, 204, 22, 0.25)",
  TREES: "rgba(22, 163, 74, 0.25)",
  DRIP: "rgba(59, 130, 246, 0.25)",
  GARDEN: "rgba(234, 179, 8, 0.25)",
};

function useBackgroundImage(url?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => setImage(img);
  }, [url]);
  return image;
}

type Props = {
  imageUrl?: string;
  onCanvasClick: (point: Point) => void;
};

export function DesignCanvas({ imageUrl, onCanvasClick }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const {
    document,
    activeTool,
    activeZoneId,
    drawingVertices,
    scalePointA,
    scalePointB,
    selectedId,
    setSelected,
    setDocument,
  } = useDesignStore();

  const bgImage = useBackgroundImage(imageUrl);
  const width = document.propertyImage?.width ?? 1200;
  const height = document.propertyImage?.height ?? 800;

  function isDimmed(zoneId?: string) {
    return activeZoneId !== null && zoneId !== activeZoneId;
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target !== e.target.getStage()) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    onCanvasClick({ x: pos.x, y: pos.y });
  }

  function handleHeadDrag(headId: string, x: number, y: number) {
    const heads = document.heads.map((h) =>
      h.id === headId && !h.locked ? { ...h, position: { x, y } } : h
    );
    setDocument({ ...document, heads });
  }

  return (
    <div className="h-full w-full overflow-auto bg-muted/30">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onClick={handleStageClick}
        draggable={activeTool === "pan"}
        className="mx-auto shadow-sm"
      >
        <Layer>
          {bgImage && (
            <KonvaImage image={bgImage} width={width} height={height} listening={false} />
          )}
          {!bgImage && (
            <Line
              points={[0, 0, width, 0, width, height, 0, height]}
              closed
              fill="#f8fafc"
              stroke="#e2e8f0"
            />
          )}

          {document.exclusionZones.map((zone) => (
            <ExclusionShape
              key={zone.id}
              zone={zone}
              opacity={isDimmed() ? 0.2 : 0.6}
              selected={selectedId === zone.id}
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
              <Group key={head.id}>
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
            />
          )}

          {drawingVertices.length > 0 && (
            <Line
              points={drawingVertices.flatMap((p) => [p.x, p.y])}
              stroke="#16a34a"
              strokeWidth={2}
              dash={[6, 4]}
            />
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
    </div>
  );
}

function HydrozoneShape({
  zone,
  fill,
  opacity,
  selected,
  onSelect,
}: {
  zone: HydrozonePolygon;
  fill: string;
  opacity: number;
  selected: boolean;
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
      onClick={onSelect}
    />
  );
}

function ExclusionShape({
  zone,
  opacity,
  selected,
  onSelect,
}: {
  zone: ExclusionZone;
  opacity: number;
  selected: boolean;
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
      onClick={onSelect}
    />
  );
}

export { generateId };

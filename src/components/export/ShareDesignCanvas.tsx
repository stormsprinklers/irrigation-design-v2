"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Image as KonvaImage, Arc, Group } from "react-konva";
import type { DesignDocument } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

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
    img.onerror = () => setImage(null);
  }, [url]);
  return image;
}

type Props = {
  document: DesignDocument;
  imageUrl?: string;
};

export function ShareDesignCanvas({ document, imageUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [userZoom, setUserZoom] = useState(1);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ initialDistance: number; initialZoom: number } | null>(null);

  const bgImage = useBackgroundImage(imageUrl);
  const width = document.propertyImage?.width ?? 1200;
  const height = document.propertyImage?.height ?? 800;
  const fitScale = containerWidth > 0 ? Math.min(1, containerWidth / width) : 1;
  const scale = fitScale * userZoom;
  const stageWidth = width * scale;
  const stageHeight = height * scale;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    setContainerWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  function clampZoom(z: number) {
    return Math.min(3, Math.max(0.5, Math.round(z * 100) / 100));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 2) {
      const pts = [...activePointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = { initialDistance: dist, initialZoom: userZoom };
      e.preventDefault();
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 2 && pinchRef.current) {
      const pts = [...activePointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const factor = dist / pinchRef.current.initialDistance;
      setUserZoom(clampZoom(pinchRef.current.initialZoom * factor));
      e.preventDefault();
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) pinchRef.current = null;
  }

  const ppf =
    document.scale && document.scale.realWorldFeet > 0
      ? Math.hypot(
          document.scale.pointB.x - document.scale.pointA.x,
          document.scale.pointB.y - document.scale.pointA.y
        ) / document.scale.realWorldFeet
      : 10;

  return (
    <div className="relative">
      <div className="absolute left-3 top-3 z-10 flex gap-1">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-10 w-10 bg-card/95 shadow-sm"
          aria-label="Zoom out"
          onClick={() => setUserZoom((z) => clampZoom(z / 1.15))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 bg-card/95 px-2 text-xs shadow-sm"
          aria-label="Fit to width"
          onClick={() => setUserZoom(1)}
        >
          <Maximize2 className="mr-1 h-3.5 w-3.5" />
          Fit
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 bg-card/95 px-2 text-xs shadow-sm"
          aria-label="Actual size"
          onClick={() => setUserZoom(clampZoom(1 / fitScale))}
        >
          100%
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-10 w-10 bg-card/95 shadow-sm"
          aria-label="Zoom in"
          onClick={() => setUserZoom((z) => clampZoom(z * 1.15))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={containerRef}
        className="w-full overflow-auto bg-muted/30"
        style={{ touchAction: "pan-x pan-y" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <p className="px-3 py-2 text-xs text-muted-foreground sm:hidden">
          Pinch to zoom · drag the plan to pan
        </p>
        <Stage
          width={stageWidth}
          height={stageHeight}
          scaleX={scale}
          scaleY={scale}
          draggable
          className="mx-auto"
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
              <Line
                key={zone.id}
                points={zone.vertices.flatMap((p) => [p.x, p.y])}
                closed
                fill="rgba(239, 68, 68, 0.2)"
                stroke="#f87171"
                strokeWidth={1}
                dash={[8, 4]}
                listening={false}
              />
            ))}

            {document.hydrozones.map((zone) => (
              <Line
                key={zone.id}
                points={zone.vertices.flatMap((p) => [p.x, p.y])}
                closed
                fill={HYDROZONE_COLORS[zone.hydrozoneType] ?? "rgba(34,197,94,0.25)"}
                stroke="#22c55e"
                strokeWidth={1}
                listening={false}
              />
            ))}

            {document.pipes.map((pipe) => (
              <Line
                key={pipe.id}
                points={pipe.points.flatMap((p) => [p.x, p.y])}
                stroke="#1e40af"
                strokeWidth={Math.max(2, pipe.diameterInches * 2)}
                listening={false}
              />
            ))}

            {document.heads.map((head) => {
              const radiusPx = head.radiusFeet * ppf;
              return (
                <Group key={head.id}>
                  <Arc
                    x={head.position.x}
                    y={head.position.y}
                    innerRadius={0}
                    outerRadius={radiusPx}
                    angle={head.arcDegrees}
                    rotation={head.rotationDegrees - head.arcDegrees / 2}
                    fill="rgba(59,130,246,0.15)"
                    listening={false}
                  />
                  <Circle
                    x={head.position.x}
                    y={head.position.y}
                    radius={6}
                    fill="#1d4ed8"
                    listening={false}
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
                listening={false}
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
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

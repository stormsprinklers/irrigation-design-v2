"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Image as KonvaImage, Arc, Group } from "react-konva";
import type { DesignDocument } from "@/lib/domain/types";

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

  const bgImage = useBackgroundImage(imageUrl);
  const width = document.propertyImage?.width ?? 1200;
  const height = document.propertyImage?.height ?? 800;
  const scale = containerWidth > 0 ? Math.min(1, containerWidth / width) : 1;
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

  const ppf =
    document.scale && document.scale.realWorldFeet > 0
      ? Math.hypot(
          document.scale.pointB.x - document.scale.pointA.x,
          document.scale.pointB.y - document.scale.pointA.y
        ) / document.scale.realWorldFeet
      : 10;

  return (
    <div ref={containerRef} className="w-full overflow-auto bg-muted/30">
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
  );
}

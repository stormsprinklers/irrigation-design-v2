"use client";

import type Konva from "konva";
import type { NozzleAdjustability } from "@/lib/catalog/adjustability";
import type { TrainingHeadSnapshot } from "@/lib/domain/training/types";
import { TRAINING_DISPLAY_PX_PER_FT } from "@/lib/domain/training/types";
import { InteractiveHeadGraphic } from "@/components/heads/InteractiveHeadGraphic";

const PX = TRAINING_DISPLAY_PX_PER_FT;

type Props = {
  head: TrainingHeadSnapshot;
  stageOffset: number;
  ghost: boolean;
  showArc: boolean;
  editable: boolean;
  selected: boolean;
  showAdjustHandles: boolean;
  adjustability: NozzleAdjustability | null;
  stripPattern?: TrainingHeadSnapshot["stripPattern"];
  patternWidthFt?: number;
  patternLengthFt?: number;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: () => void;
  onMove: (positionFt: { x: number; y: number }, opts?: { deferScores?: boolean }) => void;
  onDragEnd?: () => void;
  onPatch: (patch: Partial<TrainingHeadSnapshot>, opts?: { deferScores?: boolean }) => void;
  onInteractionStart?: () => void;
  onInteractionEnd: () => void;
};

export function TrainingHeadGraphic({
  head,
  stageOffset,
  ghost,
  showArc,
  editable,
  selected,
  showAdjustHandles,
  adjustability,
  stripPattern,
  patternWidthFt,
  patternLengthFt,
  onSelect,
  onDragStart,
  onMove,
  onDragEnd,
  onPatch,
  onInteractionStart,
  onInteractionEnd,
}: Props) {
  return (
    <InteractiveHeadGraphic
      centerX={head.positionFt.x * PX + stageOffset}
      centerY={head.positionFt.y * PX + stageOffset}
      pxPerFt={PX}
      head={head}
      ghost={ghost}
      showArc={showArc}
      editable={editable}
      selected={selected}
      showAdjustHandles={showAdjustHandles}
      adjustability={adjustability}
      coverageFill={ghost ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.18)"}
      stripPattern={stripPattern}
      patternWidthFt={patternWidthFt}
      patternLengthFt={patternLengthFt}
      onSelect={onSelect}
      onDragStart={onDragStart}
      onMove={(position, opts) =>
        onMove(
          {
            x: (position.x - stageOffset) / PX,
            y: (position.y - stageOffset) / PX,
          },
          opts?.live ? { deferScores: true } : undefined
        )
      }
      onDragEnd={onDragEnd}
      onPatch={(patch, opts) => onPatch(patch, opts?.live ? { deferScores: true } : undefined)}
      onInteractionStart={onInteractionStart}
      onInteractionEnd={onInteractionEnd}
    />
  );
}

"use client";

import {
  Hand,
  Hexagon,
  MousePointer,
  Ruler,
  GitBranch,
  CircleDot,
  Ban,
  Eraser,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignStore, type DesignTool } from "@/lib/stores/design-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

const tools: { id: DesignTool; label: string; tourId: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select", tourId: "tour-tool-select", icon: <MousePointer className="h-4 w-4" /> },
  { id: "pan", label: "Pan", tourId: "tour-tool-pan", icon: <Hand className="h-4 w-4" /> },
  { id: "hydrozone", label: "Zone", tourId: "tour-tool-hydrozone", icon: <Hexagon className="h-4 w-4" /> },
  { id: "exclusion", label: "Exclude", tourId: "tour-tool-exclusion", icon: <Ban className="h-4 w-4" /> },
  { id: "scale", label: "Scale", tourId: "tour-tool-scale", icon: <Ruler className="h-4 w-4" /> },
  { id: "head", label: "Head", tourId: "tour-tool-head", icon: <CircleDot className="h-4 w-4" /> },
  { id: "pipe", label: "Pipe", tourId: "tour-tool-pipe", icon: <GitBranch className="h-4 w-4" /> },
];

type Props = {
  layout?: "sidebar" | "dock";
};

export function DesignToolbar({ layout = "sidebar" }: Props) {
  const { activeTool, setTool, zoomIn, zoomOut, resetCanvasView, clearCanvasDesign } =
    useDesignStore();
  const [moreOpen, setMoreOpen] = useState(false);

  function handleClearCanvas() {
    const confirmed = window.confirm(
      "Clear all hydrozones, exclusion zones, heads, pipes, and valves from the canvas?\n\nThe property image, scale calibration, and water source will be kept."
    );
    if (!confirmed) return;
    clearCanvasDesign();
    toast.success("Canvas cleared");
  }

  const isDock = layout === "dock";

  function renderToolButton(tool: (typeof tools)[number]) {
    return (
      <div key={tool.id} data-tour={tool.tourId} className="shrink-0 rounded-md">
        <Button
          variant={activeTool === tool.id ? "default" : "ghost"}
          size={isDock ? "sm" : "icon"}
          title={tool.label}
          aria-label={tool.label}
          onClick={() => setTool(tool.id)}
          className={cn(
            isDock
              ? "h-11 min-w-[3.25rem] flex-col gap-0.5 px-2 py-1 text-[10px] leading-tight"
              : "h-9 w-9"
          )}
        >
          {tool.icon}
          {isDock && <span>{tool.label}</span>}
        </Button>
      </div>
    );
  }

  const secondaryActions = (
    <>
      <div data-tour="tour-tool-zoom-in" className="rounded-md">
        <Button
          variant="ghost"
          size={isDock ? "sm" : "icon"}
          title="Zoom in"
          aria-label="Zoom in"
          onClick={zoomIn}
          className={isDock ? "h-11 min-w-[3.25rem] flex-col gap-0.5 px-2 py-1 text-[10px]" : "h-9 w-9"}
        >
          <ZoomIn className="h-4 w-4" />
          {isDock && <span>Zoom in</span>}
        </Button>
      </div>
      <div data-tour="tour-tool-zoom-out" className="rounded-md">
        <Button
          variant="ghost"
          size={isDock ? "sm" : "icon"}
          title="Zoom out"
          aria-label="Zoom out"
          onClick={zoomOut}
          className={isDock ? "h-11 min-w-[3.25rem] flex-col gap-0.5 px-2 py-1 text-[10px]" : "h-9 w-9"}
        >
          <ZoomOut className="h-4 w-4" />
          {isDock && <span>Zoom out</span>}
        </Button>
      </div>
      <div data-tour="tour-tool-zoom-reset" className="rounded-md">
        <Button
          variant="ghost"
          size={isDock ? "sm" : "icon"}
          title="Reset zoom"
          aria-label="Reset zoom"
          onClick={resetCanvasView}
          className={isDock ? "h-11 min-w-[3.25rem] flex-col gap-0.5 px-2 py-1 text-[10px]" : "h-9 w-9"}
        >
          <Maximize2 className="h-4 w-4" />
          {isDock && <span>Fit</span>}
        </Button>
      </div>
      <div data-tour="tour-tool-clear" className="rounded-md">
        <Button
          variant="ghost"
          size={isDock ? "sm" : "icon"}
          title="Clear canvas"
          aria-label="Clear canvas"
          onClick={handleClearCanvas}
          className={cn(
            "text-destructive hover:text-destructive",
            isDock ? "h-11 min-w-[3.25rem] flex-col gap-0.5 px-2 py-1 text-[10px]" : "h-9 w-9"
          )}
        >
          <Eraser className="h-4 w-4" />
          {isDock && <span>Clear</span>}
        </Button>
      </div>
    </>
  );

  if (isDock) {
    return (
      <div className="safe-bottom shrink-0 border-t bg-card">
        <div className="flex items-end gap-0.5 overflow-x-auto p-1">
          {tools.map(renderToolButton)}
          <div className="relative shrink-0">
            <Button
              variant="ghost"
              size="sm"
              aria-label="More tools"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className="h-11 min-w-[3.25rem] flex-col gap-0.5 px-2 py-1 text-[10px]"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span>More</span>
            </Button>
            {moreOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setMoreOpen(false)}
                />
                <div className="absolute bottom-full right-0 z-50 mb-1 flex gap-1 rounded-lg border bg-card p-1 shadow-lg">
                  {secondaryActions}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 border-r bg-card p-2">
      {tools.map(renderToolButton)}
      <div className="my-1 border-t" />
      {secondaryActions}
    </div>
  );
}

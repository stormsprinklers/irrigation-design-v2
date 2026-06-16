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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignStore, type DesignTool } from "@/lib/stores/design-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const tools: { id: DesignTool; label: string; tourId: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select", tourId: "tour-tool-select", icon: <MousePointer className="h-4 w-4" /> },
  { id: "pan", label: "Pan", tourId: "tour-tool-pan", icon: <Hand className="h-4 w-4" /> },
  { id: "hydrozone", label: "Hydrozone", tourId: "tour-tool-hydrozone", icon: <Hexagon className="h-4 w-4" /> },
  { id: "exclusion", label: "Exclusion", tourId: "tour-tool-exclusion", icon: <Ban className="h-4 w-4" /> },
  { id: "scale", label: "Scale", tourId: "tour-tool-scale", icon: <Ruler className="h-4 w-4" /> },
  { id: "head", label: "Head", tourId: "tour-tool-head", icon: <CircleDot className="h-4 w-4" /> },
  { id: "pipe", label: "Pipe", tourId: "tour-tool-pipe", icon: <GitBranch className="h-4 w-4" /> },
];

export function DesignToolbar() {
  const { activeTool, setTool, zoomIn, zoomOut, resetCanvasView, clearCanvasDesign } =
    useDesignStore();

  function handleClearCanvas() {
    const confirmed = window.confirm(
      "Clear all hydrozones, exclusion zones, heads, pipes, and valves from the canvas?\n\nThe property image, scale calibration, and water source will be kept."
    );
    if (!confirmed) return;
    clearCanvasDesign();
    toast.success("Canvas cleared");
  }

  return (
    <div className="flex flex-col gap-1 border-r bg-card p-2">
      {tools.map((tool) => (
        <div key={tool.id} data-tour={tool.tourId} className="rounded-md">
          <Button
            variant={activeTool === tool.id ? "default" : "ghost"}
            size="icon"
            title={tool.label}
            onClick={() => setTool(tool.id)}
            className={cn("h-9 w-9")}
          >
            {tool.icon}
          </Button>
        </div>
      ))}

      <div className="my-1 border-t" />

      <div data-tour="tour-tool-zoom-in" className="rounded-md">
        <Button
          variant="ghost"
          size="icon"
          title="Zoom in"
          onClick={zoomIn}
          className="h-9 w-9"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
      <div data-tour="tour-tool-zoom-out" className="rounded-md">
        <Button
          variant="ghost"
          size="icon"
          title="Zoom out"
          onClick={zoomOut}
          className="h-9 w-9"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>
      <div data-tour="tour-tool-zoom-reset" className="rounded-md">
        <Button
          variant="ghost"
          size="icon"
          title="Reset zoom"
          onClick={resetCanvasView}
          className="h-9 w-9"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="my-1 border-t" />

      <div data-tour="tour-tool-clear" className="rounded-md">
        <Button
          variant="ghost"
          size="icon"
          title="Clear canvas"
          onClick={handleClearCanvas}
          className="h-9 w-9 text-destructive hover:text-destructive"
        >
          <Eraser className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

"use client";

import {
  Hand,
  Hexagon,
  MousePointer,
  Ruler,
  GitBranch,
  CircleDot,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignStore, type DesignTool } from "@/lib/stores/design-store";
import { cn } from "@/lib/utils";

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
  const { activeTool, setTool } = useDesignStore();

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
    </div>
  );
}

"use client";

import {
  Hand,
  Hexagon,
  MousePointer,
  Ruler,
  Droplets,
  GitBranch,
  CircleDot,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignStore, type DesignTool } from "@/lib/stores/design-store";
import { cn } from "@/lib/utils";

const tools: { id: DesignTool; label: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select", icon: <MousePointer className="h-4 w-4" /> },
  { id: "pan", label: "Pan", icon: <Hand className="h-4 w-4" /> },
  { id: "hydrozone", label: "Hydrozone", icon: <Hexagon className="h-4 w-4" /> },
  { id: "exclusion", label: "Exclusion", icon: <Ban className="h-4 w-4" /> },
  { id: "scale", label: "Scale", icon: <Ruler className="h-4 w-4" /> },
  { id: "head", label: "Head", icon: <CircleDot className="h-4 w-4" /> },
  { id: "pipe", label: "Pipe", icon: <GitBranch className="h-4 w-4" /> },
];

export function DesignToolbar() {
  const { activeTool, setTool } = useDesignStore();

  return (
    <div className="flex flex-col gap-1 border-r bg-card p-2">
      {tools.map((tool) => (
        <Button
          key={tool.id}
          variant={activeTool === tool.id ? "default" : "ghost"}
          size="icon"
          title={tool.label}
          onClick={() => setTool(tool.id)}
          className={cn("h-9 w-9")}
        >
          {tool.icon}
        </Button>
      ))}
      <div className="my-2 border-t" />
      <Button variant="ghost" size="icon" title="Water source" className="h-9 w-9">
        <Droplets className="h-4 w-4" />
      </Button>
    </div>
  );
}

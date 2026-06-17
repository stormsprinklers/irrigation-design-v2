"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Icon-only toggle between light and dark */
  compact?: boolean;
  className?: string;
};

const MODES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle({ compact = false, className }: Props) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return compact ? (
      <div className={cn("h-9 w-9", className)} aria-hidden />
    ) : (
      <div className={cn("h-9 w-[7.5rem]", className)} aria-hidden />
    );
  }

  if (compact) {
    const isDark = resolvedTheme === "dark";
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={className}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 rounded-md border bg-background p-1", className)}>
      {MODES.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          variant={theme === value ? "secondary" : "ghost"}
          size="sm"
          className="h-7 flex-1 px-2"
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="sr-only">{label}</span>
        </Button>
      ))}
    </div>
  );
}

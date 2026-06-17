"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TourPlacement } from "@/lib/tour/design-tour-steps";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  body: string;
  stepIndex: number;
  stepCount: number;
  placement: TourPlacement;
  style: React.CSSProperties;
  isLast: boolean;
  finishLabel?: string;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: (dontAutoShow: boolean) => void;
};

const TAIL_CLASSES: Record<TourPlacement, string> = {
  right: "left-0 top-8 -translate-x-full border-r-card border-t-transparent border-b-transparent border-l-transparent",
  left: "right-0 top-8 translate-x-full border-l-card border-t-transparent border-b-transparent border-r-transparent",
  bottom: "top-0 left-1/2 -translate-x-1/2 -translate-y-full border-b-card border-l-transparent border-r-transparent border-t-transparent",
  top: "bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-t-card border-l-transparent border-r-transparent border-b-transparent",
  center: "hidden",
};

export function TourBubble({
  title,
  body,
  stepIndex,
  stepCount,
  placement,
  style,
  isLast,
  finishLabel = "Start designing",
  onBack,
  onNext,
  onSkip,
  onFinish,
}: Props) {
  const [dontAutoShow, setDontAutoShow] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-bubble-title"
      className={cn(
        "tour-bubble-enter fixed z-[70] w-[min(340px,calc(100vw-32px))] rounded-xl border bg-card p-5 shadow-xl",
        placement === "center" && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      )}
      style={placement === "center" ? undefined : style}
    >
      {placement !== "center" && (
        <div
          className={cn("absolute h-0 w-0 border-[10px]", TAIL_CLASSES[placement])}
          aria-hidden
        />
      )}

      <div className="mb-1 text-xs font-medium text-primary">
        Step {stepIndex + 1} of {stepCount}
      </div>
      <h3 id="tour-bubble-title" className="text-base font-semibold">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>

      {isLast && (
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={dontAutoShow}
            onChange={(e) => setDontAutoShow(e.target.checked)}
            className="rounded border-input"
          />
          Don&apos;t auto-show this again
        </label>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground"
          aria-label="Skip tour"
        >
          Skip tour
        </button>
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              aria-label="Previous step"
            >
              Back
            </Button>
          )}
          {isLast ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onFinish(dontAutoShow)}
              aria-label={finishLabel}
            >
              {finishLabel}
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={onNext} aria-label="Next step">
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

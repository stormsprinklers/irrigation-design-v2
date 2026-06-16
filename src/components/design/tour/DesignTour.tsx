"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TourSpotlight, type SpotlightRect } from "./TourSpotlight";
import { TourBubble } from "./TourBubble";
import { useTourStore } from "@/lib/stores/tour-store";
import { DESIGN_TOUR_STEPS } from "@/lib/tour/design-tour-steps";
import type { TourPlacement } from "@/lib/tour/design-tour-steps";
import { completeTour } from "@/lib/actions/tour";
import type { TourStatus } from "@/lib/actions/tour";
import { CircleHelp } from "lucide-react";

const BUBBLE_GAP = 16;
const BUBBLE_WIDTH = 340;
const BUBBLE_HEIGHT_ESTIMATE = 220;

function getTargetElement(targetId: string): HTMLElement | null {
  return document.querySelector(`[data-tour="${targetId}"]`);
}

function computeBubblePosition(
  rect: DOMRect,
  placement: TourPlacement
): { style: React.CSSProperties; effectivePlacement: TourPlacement } {
  if (placement === "center") {
    return { style: {}, effectivePlacement: "center" };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let effective = placement;
  let top = 0;
  let left = 0;

  const fitsRight = rect.right + BUBBLE_GAP + BUBBLE_WIDTH < vw - 16;
  const fitsLeft = rect.left - BUBBLE_GAP - BUBBLE_WIDTH > 16;
  const fitsBottom = rect.bottom + BUBBLE_GAP + BUBBLE_HEIGHT_ESTIMATE < vh - 16;
  const fitsTop = rect.top - BUBBLE_GAP - BUBBLE_HEIGHT_ESTIMATE > 16;

  if (placement === "right" && !fitsRight && fitsLeft) effective = "left";
  if (placement === "left" && !fitsLeft && fitsRight) effective = "right";
  if (placement === "bottom" && !fitsBottom && fitsTop) effective = "top";
  if (placement === "top" && !fitsTop && fitsBottom) effective = "bottom";

  switch (effective) {
    case "right":
      top = rect.top + rect.height / 2 - 40;
      left = rect.right + BUBBLE_GAP;
      break;
    case "left":
      top = rect.top + rect.height / 2 - 40;
      left = rect.left - BUBBLE_GAP - BUBBLE_WIDTH;
      break;
    case "bottom":
      top = rect.bottom + BUBBLE_GAP;
      left = rect.left + rect.width / 2 - BUBBLE_WIDTH / 2;
      break;
    case "top":
      top = rect.top - BUBBLE_GAP - BUBBLE_HEIGHT_ESTIMATE;
      left = rect.left + rect.width / 2 - BUBBLE_WIDTH / 2;
      break;
    default:
      break;
  }

  top = Math.max(16, Math.min(top, vh - BUBBLE_HEIGHT_ESTIMATE - 16));
  left = Math.max(16, Math.min(left, vw - BUBBLE_WIDTH - 16));

  return {
    style: { top, left },
    effectivePlacement: effective,
  };
}

type Props = {
  initialStatus: TourStatus;
};

export function DesignTour({ initialStatus }: Props) {
  const { isActive, currentStep, startTour, next, prev, skip, endTour } = useTourStore();
  const [mounted, setMounted] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [bubbleStyle, setBubbleStyle] = useState<React.CSSProperties>({});
  const [effectivePlacement, setEffectivePlacement] = useState<TourPlacement>("center");
  const [highlightedEl, setHighlightedEl] = useState<HTMLElement | null>(null);
  const hasAutoStarted = useRef(false);

  const step = DESIGN_TOUR_STEPS[currentStep];
  const isLast = currentStep === DESIGN_TOUR_STEPS.length - 1;

  const updatePosition = useCallback(() => {
    if (!step) return;

    const el = getTargetElement(step.target);
    if (!el || step.placement === "center") {
      setSpotlightRect(null);
      setEffectivePlacement("center");
      setBubbleStyle({});
      if (highlightedEl) {
        highlightedEl.classList.remove("tour-target-highlight", "relative", "z-[65]");
        setHighlightedEl(null);
      }
      return;
    }

    if (step.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setSpotlightRect(null);
      setEffectivePlacement("center");
      return;
    }

    setSpotlightRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });

    const { style, effectivePlacement: ep } = computeBubblePosition(rect, step.placement);
    setBubbleStyle(style);
    setEffectivePlacement(ep);

    if (highlightedEl && highlightedEl !== el) {
      highlightedEl.classList.remove("tour-target-highlight", "relative", "z-[65]");
    }
    el.classList.add("tour-target-highlight", "relative", "z-[65]");
    setHighlightedEl(el);
  }, [step, highlightedEl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || hasAutoStarted.current) return;
    const shouldAutoStart =
      initialStatus.autoShow && initialStatus.completedAt === null;
    if (shouldAutoStart) {
      hasAutoStarted.current = true;
      const timer = setTimeout(() => startTour(), 300);
      return () => clearTimeout(timer);
    }
  }, [mounted, initialStatus.autoShow, initialStatus.completedAt, startTour]);

  useEffect(() => {
    if (!isActive) {
      if (highlightedEl) {
        highlightedEl.classList.remove("tour-target-highlight", "relative", "z-[65]");
        setHighlightedEl(null);
      }
      return;
    }

    const timer = setTimeout(updatePosition, 50);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isActive, currentStep, updatePosition, highlightedEl]);

  const handleSkip = useCallback(async () => {
    try {
      await completeTour(true);
    } catch {
      // Non-blocking
    }
    if (highlightedEl) {
      highlightedEl.classList.remove("tour-target-highlight", "relative", "z-[65]");
    }
    skip();
  }, [highlightedEl, skip]);

  const handleFinish = useCallback(
    async (dontAutoShow: boolean) => {
      try {
        await completeTour(!dontAutoShow);
      } catch {
        // Non-blocking
      }
      if (highlightedEl) {
        highlightedEl.classList.remove("tour-target-highlight", "relative", "z-[65]");
      }
      endTour();
    },
    [highlightedEl, endTour]
  );

  useEffect(() => {
    if (!isActive) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        void handleSkip();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isActive, handleSkip]);

  if (!mounted || !isActive || !step) return null;

  return createPortal(
    <>
      <TourSpotlight rect={spotlightRect} />
      <div className="fixed inset-0 z-[65] pointer-events-auto" aria-hidden />
      <div className="pointer-events-auto">
        <TourBubble
          key={step.id}
          title={step.title}
          body={step.body}
          stepIndex={currentStep}
          placement={effectivePlacement}
          style={bubbleStyle}
          isLast={isLast}
          onBack={prev}
          onNext={next}
          onSkip={handleSkip}
          onFinish={handleFinish}
        />
      </div>
    </>,
    document.body
  );
}

export function TourHelpButton() {
  const startTour = useTourStore((s) => s.startTour);

  return (
    <button
      type="button"
      onClick={() => startTour()}
      className="flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
      title="Design workspace tour"
      aria-label="Start design workspace tour"
    >
      <CircleHelp className="h-4 w-4" />
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";

/** Matches Tailwind `lg` breakpoint — mobile/tablet portrait below 1024px. */
export const MOBILE_MAX_WIDTH_PX = 1023;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

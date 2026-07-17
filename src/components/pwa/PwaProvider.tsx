"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "irrigation-design-pwa-install-dismissed";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (error) {
    console.error("Service worker registration failed", error);
  }
}

/** Guides iOS users to Add to Home Screen; registers the PWA service worker. */
export function PwaProvider() {
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    void registerServiceWorker();
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const mobile = isIosDevice() || /Android/i.test(navigator.userAgent);
    setShowInstall(mobile);
  }, []);

  if (!showInstall) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm sm:rounded-lg sm:border sm:pb-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
          <Share className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install Design</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isIosDevice()
              ? "Tap Share, then Add to Home Screen for a full-screen app with easier touch editing."
              : "Add Irrigation Design to your home screen for quicker access."}
          </p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setShowInstall(false);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createShareLink } from "@/lib/actions/design";

type Props = {
  projectId: string;
};

export function ShareMenu({ projectId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  async function handleShare(view: "CUSTOMER" | "INSTALLER", label: string) {
    const link = await createShareLink(projectId, view);
    setShareUrl(`${window.location.origin}/share/${link.token}`);
    setShareLabel(label);
    setCopied(false);
    setMenuOpen(false);
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Share"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <Share2 className="h-4 w-4" />
      </Button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] max-w-[calc(100vw-2rem)] rounded-md border bg-card py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => handleShare("CUSTOMER", "Customer")}
          >
            Customer
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => handleShare("INSTALLER", "Contractor")}
          >
            Contractor
          </button>
        </div>
      )}

      {shareUrl && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-md border bg-card p-3 shadow-md">
          <p className="text-xs font-medium text-muted-foreground">
            {shareLabel} share link
          </p>
          <div className="mt-2 flex items-center gap-1">
            <input
              readOnly
              value={shareUrl}
              className="h-8 min-w-0 flex-1 rounded-md border bg-muted/40 px-2 text-xs"
              onFocus={(e) => e.target.select()}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 px-2"
              aria-label="Copy link"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {copied && (
            <p className="mt-2 text-xs font-medium text-green-600">Link copied to clipboard</p>
          )}
        </div>
      )}
    </div>
  );
}

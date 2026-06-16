"use client";

import dynamic from "next/dynamic";
import type { DesignDocument } from "@/lib/domain/types";

const ShareDesignCanvas = dynamic(
  () => import("./ShareDesignCanvas").then((m) => m.ShareDesignCanvas),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted" /> }
);

type Props = {
  document: DesignDocument;
  imageUrl?: string;
};

export function ShareDesignSection({ document, imageUrl }: Props) {
  const hasGeometry =
    document.hydrozones.length > 0 ||
    document.heads.length > 0 ||
    document.pipes.length > 0 ||
    Boolean(document.propertyImage);

  if (!hasGeometry) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Sprinkler system design</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Drag to pan the plan. Hydrozones, heads, pipes, and valves are shown to scale.
      </p>
      <div className="mt-4 overflow-hidden rounded-lg border">
        <ShareDesignCanvas document={document} imageUrl={imageUrl} />
      </div>
    </section>
  );
}

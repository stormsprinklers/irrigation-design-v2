"use client";

export type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type Props = {
  rect: SpotlightRect | null;
  padding?: number;
};

export function TourSpotlight({ rect, padding = 8 }: Props) {
  if (!rect) {
    return (
      <div
        className="tour-spotlight-enter fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-[1px]"
        aria-hidden
      />
    );
  }

  const p = padding;
  const x = rect.left - p;
  const y = rect.top - p;
  const w = rect.width + p * 2;
  const h = rect.height + p * 2;
  const r = 8;

  const maskId = "tour-spotlight-mask";

  return (
    <svg
      className="tour-spotlight-enter fixed inset-0 z-[60] h-full w-full pointer-events-none"
      aria-hidden
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.45)"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

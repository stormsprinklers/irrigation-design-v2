import type { Point } from "../types";
import { signedAreaPositive } from "../placement/geometry";
import type { TrainingShapeClass } from "./types";

function ensureCcw(vertices: Point[]): Point[] {
  return signedAreaPositive(vertices) ? vertices : [...vertices].reverse();
}

function edgeLengthFt(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function sampleQuadraticBezier(a: Point, control: Point, b: Point, segments: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    points.push({
      x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
    });
  }
  return points;
}

function sampleWavyEdge(
  a: Point,
  b: Point,
  amplitudeFt: number,
  waveCount: number,
  segments: number
): Point[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [a, b];

  const nx = -dy / len;
  const ny = dx / len;
  const points: Point[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wave = amplitudeFt * Math.sin(t * Math.PI * 2 * waveCount);
    points.push({
      x: a.x + dx * t + nx * wave,
      y: a.y + dy * t + ny * wave,
    });
  }

  return points;
}

function sampleArc(
  center: Point,
  radiusFt: number,
  startRad: number,
  endRad: number,
  segments: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startRad + (endRad - startRad) * t;
    points.push({
      x: center.x + radiusFt * Math.cos(angle),
      y: center.y + radiusFt * Math.sin(angle),
    });
  }
  return points;
}

function replacePolygonEdge(vertices: Point[], edgeIndex: number, samples: Point[]): Point[] {
  const n = vertices.length;
  const result: Point[] = [];

  for (let i = 0; i < n; i++) {
    result.push(vertices[i]!);
    if (i === edgeIndex) {
      for (let j = 1; j < samples.length - 1; j++) {
        result.push(samples[j]!);
      }
    }
  }

  return result;
}

function perpendicularOffset(a: Point, b: Point, distanceFt: number, sign: 1 | -1): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const nx = (-dy / len) * sign;
  const ny = (dx / len) * sign;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return { x: mid.x + nx * distanceFt, y: mid.y + ny * distanceFt };
}

function segmentCountForLength(lengthFt: number, targetSegmentFt: number): number {
  return Math.max(6, Math.min(20, Math.round(lengthFt / targetSegmentFt)));
}

function curvedEdgeSamples(
  a: Point,
  b: Point,
  bulgeFt: number,
  inward: boolean,
  segments: number
): Point[] {
  const control = perpendicularOffset(a, b, bulgeFt, inward ? -1 : 1);
  return sampleQuadraticBezier(a, control, b, segments);
}

function pickDistinctIndices(rng: () => number, count: number, max: number): number[] {
  const pool = Array.from({ length: max }, (_, i) => i);
  const picked: number[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]!);
  }
  return picked;
}

/** Replace 1–3 long straight edges with bowed (quadratic) or wavy segments. */
export function applyOrganicEdges(
  vertices: Point[],
  rng: () => number,
  opts?: { minEdgeFt?: number; probability?: number }
): Point[] {
  const minEdgeFt = opts?.minEdgeFt ?? 14;
  const probability = opts?.probability ?? 1;

  if (rng() > probability) return vertices;

  const eligible: number[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    if (edgeLengthFt(a, b) >= minEdgeFt) eligible.push(i);
  }

  if (eligible.length === 0) return vertices;

  const editCount = Math.min(eligible.length, 1 + Math.floor(rng() * 3));
  const edges = pickDistinctIndices(
    rng,
    editCount,
    eligible.length
  ).map((i) => eligible[i]!);

  let result = vertices;
  for (const edgeIndex of [...edges].sort((a, b) => b - a)) {
    const a = result[edgeIndex]!;
    const b = result[(edgeIndex + 1) % result.length]!;
    const lengthFt = edgeLengthFt(a, b);
    const segments = segmentCountForLength(lengthFt, 5);
    const wavy = rng() < 0.45;

    const samples = wavy
      ? sampleWavyEdge(
          a,
          b,
          1.5 + rng() * 3.5,
          2 + Math.floor(rng() * 4),
          segments
        )
      : curvedEdgeSamples(
          a,
          b,
          Math.min(lengthFt * 0.22, 2 + rng() * 7),
          rng() < 0.35,
          segments
        );

    result = replacePolygonEdge(result, edgeIndex, samples);
  }

  return result;
}

export function maybeApplyOrganicEdges(
  vertices: Point[],
  shapeClass: TrainingShapeClass,
  rng: () => number
): Point[] {
  if (shapeClass === "narrow_strip" || isNearCircular(vertices)) return vertices;
  // ~42% of generated lawns get curved or wavy edge treatment.
  return applyOrganicEdges(vertices, rng, { probability: 0.42 });
}

function isNearCircular(vertices: Point[]): boolean {
  if (vertices.length < 18) return false;

  const lengths: number[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    lengths.push(edgeLengthFt(a, b));
  }

  const mean = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
  if (mean < 1e-6) return false;

  return lengths.every((len) => Math.abs(len - mean) / mean < 0.08);
}

/** Rectangle with circular-arc corners (all four sides include curved segments). */
export function roundedRectangle(
  rng: () => number,
  randRange: (rng: () => number, min: number, max: number) => number,
  randInt: (rng: () => number, min: number, max: number) => number
): Point[] {
  const w = randRange(rng, 36, 58);
  const h = randRange(rng, 26, 46);
  const r = randRange(rng, 4, Math.min(w, h) * 0.2);
  const segs = randInt(rng, 4, 8);

  const arcs = [
    { cx: w - r, cy: r, a0: -Math.PI / 2, a1: 0 },
    { cx: w - r, cy: h - r, a0: 0, a1: Math.PI / 2 },
    { cx: r, cy: h - r, a0: Math.PI / 2, a1: Math.PI },
    { cx: r, cy: r, a0: Math.PI, a1: (3 * Math.PI) / 2 },
  ];

  const points: Point[] = [];
  for (const arc of arcs) {
    const arcPts = sampleArc({ x: arc.cx, y: arc.cy }, r, arc.a0, arc.a1, segs);
    const start = points.length === 0 ? 0 : 1;
    for (let i = start; i < arcPts.length; i++) {
      points.push(arcPts[i]!);
    }
  }

  return ensureCcw(points);
}

/** Lawn with one wavy street-facing edge and straight sides elsewhere. */
export function wavyFrontYard(
  rng: () => number,
  randRange: (rng: () => number, min: number, max: number) => number
): Point[] {
  const w = randRange(rng, 48, 68);
  const h = randRange(rng, 28, 42);
  const front = sampleWavyEdge(
    { x: 0, y: 0 },
    { x: w, y: 0 },
    randRange(rng, 2, 5),
    2 + Math.floor(rng() * 3),
    segmentCountForLength(w, 4)
  );

  const vertices: Point[] = [];
  for (let i = 0; i < front.length - 1; i++) {
    vertices.push(front[i]!);
  }
  vertices.push({ x: w, y: h }, { x: 0, y: h });
  return ensureCcw(vertices);
}

/** Circular lawn discretized into evenly spaced vertices. */
export function circularLawn(
  rng: () => number,
  randRange: (rng: () => number, min: number, max: number) => number,
  randInt: (rng: () => number, min: number, max: number) => number
): Point[] {
  const radiusFt = randRange(rng, 14, 28);
  const segments = randInt(rng, 20, 32);
  const center = { x: radiusFt, y: radiusFt };
  const points: Point[] = [];

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: center.x + radiusFt * Math.cos(angle),
      y: center.y + radiusFt * Math.sin(angle),
    });
  }

  return ensureCcw(points);
}

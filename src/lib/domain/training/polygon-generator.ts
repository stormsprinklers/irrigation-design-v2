import { pointInPolygon, polygonBounds, polygonEdgeLengthsFt, roundLengthFt } from "../placement/geometry";
import type { Point } from "../types";
import type {
  GeneratedTrainingPolygon,
  TrainingPolygonMetadata,
  TrainingShapeClass,
} from "./types";
import {
  applyOrganicEdges,
  maybeApplyOrganicEdges,
  roundedRectangle,
  wavyFrontYard,
  circularLawn,
} from "./organic-edges";
import {
  normalizeSceneToOrigin,
} from "./exclusion-generator";

export type PolygonGeneratorOptions = {
  seed?: number;
  shapeClass?: TrainingShapeClass;
  minWidthFt?: number;
  maxWidthFt?: number;
  minHeightFt?: number;
  maxHeightFt?: number;
};

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function polygonArea(vertices: Point[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
}

function polygonSignedArea(vertices: Point[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

function ensureCcw(vertices: Point[]): Point[] {
  return polygonSignedArea(vertices) >= 0 ? vertices : [...vertices].reverse();
}

function polygonCentroid(vertices: Point[]): Point {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const cross = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
    area2 += cross;
    cx += (vertices[i].x + vertices[j].x) * cross;
    cy += (vertices[i].y + vertices[j].y) * cross;
  }
  if (Math.abs(area2) < 1e-9) {
    const n = vertices.length;
    return {
      x: vertices.reduce((s, v) => s + v.x, 0) / n,
      y: vertices.reduce((s, v) => s + v.y, 0) / n,
    };
  }
  const factor = 1 / (3 * area2);
  return { x: cx * factor, y: cy * factor };
}

function rotatePolygon(vertices: Point[], degrees: number, center: Point): Point[] {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return vertices.map((v) => {
    const dx = v.x - center.x;
    const dy = v.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  });
}

function normalizeToOrigin(vertices: Point[]): Point[] {
  const b = polygonBounds(vertices);
  return vertices.map((v) => ({ x: v.x - b.minX, y: v.y - b.minY }));
}

function minEdgeLength(vertices: Point[]): number {
  let min = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const dx = vertices[j].x - vertices[i].x;
    const dy = vertices[j].y - vertices[i].y;
    min = Math.min(min, Math.hypot(dx, dy));
  }
  return min;
}

function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  function orient(p: Point, q: Point, r: Point) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  }
  function onSegment(p: Point, q: Point, r: Point) {
    return (
      Math.min(p.x, r.x) <= q.x &&
      q.x <= Math.max(p.x, r.x) &&
      Math.min(p.y, r.y) <= q.y &&
      q.y <= Math.max(p.y, r.y)
    );
  }

  const o1 = orient(a1, a2, b1);
  const o2 = orient(a1, a2, b2);
  const o3 = orient(b1, b2, a1);
  const o4 = orient(b1, b2, a2);

  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

function isSimplePolygon(vertices: Point[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

function isSimpleEnough(vertices: Point[]): boolean {
  if (vertices.length < 3) return false;
  if (polygonArea(vertices) < 80) return false;
  if (minEdgeLength(vertices) < 4) return false;
  if (!isSimplePolygon(vertices)) return false;
  const b = polygonBounds(vertices);
  const test = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  return pointInPolygon(test, vertices);
}

function metadataFor(
  vertices: Point[],
  shapeClass: TrainingShapeClass,
  seed: number,
  rotationDeg: number
): TrainingPolygonMetadata {
  const b = polygonBounds(vertices);
  return {
    shapeClass,
    seed,
    widthFt: Math.round((b.maxX - b.minX) * 10) / 10,
    heightFt: Math.round((b.maxY - b.minY) * 10) / 10,
    areaSqFt: Math.round(polygonArea(vertices) * 10) / 10,
    vertexCount: vertices.length,
    sideLengthsFt: polygonEdgeLengthsFt(vertices).map(roundLengthFt),
    hasExclusions: false,
    rotationDeg: Math.round(rotationDeg * 10) / 10,
  };
}

function applyRotationAndNormalize(
  vertices: Point[],
  rotationDeg: number
): Point[] {
  const center = polygonCentroid(vertices);
  const rotated = rotatePolygon(vertices, rotationDeg, center);
  return normalizeToOrigin(rotated);
}

function rectangle(w: number, h: number): Point[] {
  return ensureCcw([
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]);
}

function lShape(rng: () => number): Point[] {
  const w = randRange(rng, 35, 55);
  const h = randRange(rng, 30, 45);
  const cutW = randRange(rng, w * 0.35, w * 0.55);
  const cutH = randRange(rng, h * 0.35, h * 0.55);
  return ensureCcw([
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h - cutH },
    { x: w - cutW, y: h - cutH },
    { x: w - cutW, y: h },
    { x: 0, y: h },
  ]);
}

function narrowStrip(rng: () => number): Point[] {
  const length = randRange(rng, 40, 80);
  const width = randRange(rng, 4, 12);
  return rectangle(length, width);
}

function concaveNotch(rng: () => number): Point[] {
  const w = randRange(rng, 45, 65);
  const h = randRange(rng, 25, 40);
  const nw = randRange(rng, 10, 18);
  const nd = randRange(rng, 6, 12);
  const nx = (w - nw) / 2;
  return ensureCcw([
    { x: 0, y: 0 },
    { x: nx, y: 0 },
    { x: nx, y: nd },
    { x: nx + nw, y: nd },
    { x: nx + nw, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]);
}

function frontYard(rng: () => number): Point[] {
  const streetWidth = randRange(rng, 50, 70);
  const depth = randRange(rng, 20, 35);
  const setback = randRange(rng, 6, 12);
  const houseWidth = randRange(rng, streetWidth * 0.55, streetWidth * 0.75);
  const hx = (streetWidth - houseWidth) / 2;
  return ensureCcw([
    { x: 0, y: 0 },
    { x: streetWidth, y: 0 },
    { x: streetWidth, y: depth },
    { x: hx + houseWidth, y: depth },
    { x: hx + houseWidth, y: depth - setback },
    { x: hx, y: depth - setback },
    { x: hx, y: depth },
    { x: 0, y: depth },
  ]);
}

function backYard(rng: () => number): Point[] {
  const w = randRange(rng, 40, 60);
  const h = randRange(rng, 35, 55);
  return rectangle(w, h);
}

/** Organic blob with strongly varying edge radii — not orthogonal. */
function irregularBlob(rng: () => number): Point[] {
  const vertexCount = randInt(rng, 9, 14);
  const cx = randRange(rng, 28, 38);
  const cy = randRange(rng, 24, 34);
  const baseR = randRange(rng, 20, 30);
  const phase = randRange(rng, 0, Math.PI * 2);
  const vertices: Point[] = [];

  for (let i = 0; i < vertexCount; i++) {
    const angle = phase + (i / vertexCount) * Math.PI * 2;
    const radiusScale = randRange(rng, 0.45, 1.4);
    const wobble = 1 + randRange(rng, -0.12, 0.12) * Math.sin(angle * 3 + phase);
    const r = baseR * radiusScale * wobble;
    vertices.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }

  return ensureCcw(vertices);
}

/** Orthogonal lawn with multiple bays on different sides — distinct from a single L-cut. */
function irregularMultiBay(rng: () => number): Point[] {
  const w = randRange(rng, 52, 72);
  const h = randRange(rng, 42, 58);
  const topBayW = randRange(rng, 10, 18);
  const topBayD = randRange(rng, 8, 14);
  const topBayX = randRange(rng, w * 0.2, w * 0.55);
  const rightBayW = randRange(rng, 9, 16);
  const rightBayD = randRange(rng, 10, 16);
  const rightBayY = randRange(rng, h * 0.25, h * 0.55);
  const bottomBayW = randRange(rng, 12, 20);
  const bottomBayD = randRange(rng, 8, 14);
  const bottomBayX = randRange(rng, w * 0.35, w * 0.7);

  return ensureCcw([
    { x: 0, y: 0 },
    { x: topBayX, y: 0 },
    { x: topBayX, y: topBayD },
    { x: topBayX + topBayW, y: topBayD },
    { x: topBayX + topBayW, y: 0 },
    { x: w, y: 0 },
    { x: w, y: rightBayY },
    { x: w - rightBayW, y: rightBayY },
    { x: w - rightBayW, y: rightBayY + rightBayD },
    { x: w, y: rightBayY + rightBayD },
    { x: w, y: h },
    { x: bottomBayX + bottomBayW, y: h },
    { x: bottomBayX + bottomBayW, y: h - bottomBayD },
    { x: bottomBayX, y: h - bottomBayD },
    { x: bottomBayX, y: h },
    { x: 0, y: h },
  ]);
}

/** C-shaped / hook footprint wrapping an interior void corner. */
function irregularHook(rng: () => number): Point[] {
  const outerW = randRange(rng, 48, 62);
  const outerH = randRange(rng, 40, 54);
  const armW = randRange(rng, 14, 22);
  const armH = randRange(rng, 16, 24);
  const gapW = randRange(rng, 16, 26);
  const gapH = randRange(rng, 14, 22);

  return ensureCcw([
    { x: 0, y: 0 },
    { x: outerW, y: 0 },
    { x: outerW, y: outerH - armH },
    { x: outerW - gapW, y: outerH - armH },
    { x: outerW - gapW, y: outerH - armH - gapH },
    { x: armW, y: outerH - armH - gapH },
    { x: armW, y: outerH },
    { x: 0, y: outerH },
  ]);
}

/** Stepped zigzag boundary — long perimeter with alternating protrusions. */
function irregularZigzag(rng: () => number): Point[] {
  const baseW = randRange(rng, 55, 75);
  const baseH = randRange(rng, 30, 42);
  const stepCount = randInt(rng, 4, 6);
  const stepW = baseW / stepCount;
  const vertices: Point[] = [{ x: 0, y: 0 }];

  for (let i = 0; i < stepCount; i++) {
    const x = (i + 1) * stepW;
    const protrude = i % 2 === 0 ? randRange(rng, 6, 14) : randRange(rng, 2, 6);
    vertices.push({ x, y: protrude });
  }
  vertices.push({ x: baseW, y: baseH });
  vertices.push({ x: 0, y: baseH });

  return ensureCcw(vertices);
}

/** Kidney / bean with a smooth concave waist on one side. */
function irregularKidney(rng: () => number): Point[] {
  const w = randRange(rng, 48, 64);
  const h = randRange(rng, 36, 50);
  const pinchX = randRange(rng, w * 0.35, w * 0.65);
  const pinchDepth = randRange(rng, h * 0.22, h * 0.38);
  const bulge = randRange(rng, w * 0.12, w * 0.22);

  return ensureCcw([
    { x: 0, y: h * 0.35 },
    { x: bulge, y: 0 },
    { x: w - bulge, y: 0 },
    { x: w, y: h * 0.3 },
    { x: w, y: h * 0.7 },
    { x: w - bulge, y: h },
    { x: bulge, y: h },
    { x: 0, y: h * 0.65 },
    { x: pinchX - randRange(rng, 4, 8), y: h * 0.5 },
    { x: pinchX, y: h * 0.5 - pinchDepth },
    { x: pinchX + randRange(rng, 4, 8), y: h * 0.5 },
  ]);
}

const IRREGULAR_BUILDERS: ((rng: () => number) => Point[])[] = [
  irregularBlob,
  irregularMultiBay,
  irregularHook,
  irregularZigzag,
  irregularKidney,
  (rng) => roundedRectangle(rng, randRange, randInt),
  (rng) => wavyFrontYard(rng, randRange),
  (rng) => circularLawn(rng, randRange, randInt),
];

function irregular(rng: () => number): Point[] {
  const builder = IRREGULAR_BUILDERS[randInt(rng, 0, IRREGULAR_BUILDERS.length - 1)];
  return builder(rng);
}

const SHAPE_BUILDERS: Record<
  TrainingShapeClass,
  (rng: () => number) => Point[]
> = {
  rectangle: (rng) => rectangle(randRange(rng, 30, 60), randRange(rng, 20, 45)),
  l_shape: lShape,
  narrow_strip: narrowStrip,
  concave: concaveNotch,
  front_yard: frontYard,
  back_yard: backYard,
  irregular,
};

const ALL_SHAPES: TrainingShapeClass[] = [
  "rectangle",
  "l_shape",
  "narrow_strip",
  "concave",
  "front_yard",
  "back_yard",
  "irregular",
];

function buildVertices(shapeClass: TrainingShapeClass, rng: () => number): Point[] {
  let vertices = SHAPE_BUILDERS[shapeClass](rng);
  vertices = maybeApplyOrganicEdges(vertices, shapeClass, rng);
  return vertices;
}

function finalizePolygon(
  vertices: Point[],
  shapeClass: TrainingShapeClass,
  seed: number,
  rotationDeg: number,
  _rng: () => number
): GeneratedTrainingPolygon {
  const rotated = applyRotationAndNormalize(vertices, rotationDeg);
  if (!isSimpleEnough(rotated)) {
    const fallback = rectangle(45, 30);
    const fallbackRot = applyRotationAndNormalize(fallback, rotationDeg);
    const normalized = normalizeSceneToOrigin(fallbackRot, []);
    return {
      verticesFt: normalized.lawnVertices,
      metadata: metadataFor(
        normalized.lawnVertices,
        "rectangle",
        seed,
        rotationDeg
      ),
      exclusionZonesFt: [],
    };
  }

  const normalized = normalizeSceneToOrigin(rotated, []);
  return {
    verticesFt: normalized.lawnVertices,
    metadata: metadataFor(
      normalized.lawnVertices,
      shapeClass,
      seed,
      rotationDeg
    ),
    exclusionZonesFt: [],
  };
}

export function generateTrainingPolygon(
  options: PolygonGeneratorOptions = {}
): GeneratedTrainingPolygon {
  const seed = options.seed ?? Math.floor(Math.random() * 1_000_000);
  const rng = mulberry32(seed);
  const shapeClass =
    options.shapeClass ?? ALL_SHAPES[Math.floor(rng() * ALL_SHAPES.length)];
  const rotationDeg = randRange(rng, 0, 360);

  let vertices = buildVertices(shapeClass, rng);
  if (!isSimpleEnough(vertices)) {
    vertices = rectangle(45, 30);
    vertices = applyOrganicEdges(vertices, rng, { probability: 0.25, minEdgeFt: 18 });
    if (!isSimpleEnough(vertices)) {
      vertices = rectangle(45, 30);
    }
    return finalizePolygon(vertices, "rectangle", seed, rotationDeg, rng);
  }

  return finalizePolygon(vertices, shapeClass, seed, rotationDeg, rng);
}

/** Exported for tests — compare unrotated canonical shapes (no organic edge pass). */
export function buildCanonicalTrainingPolygon(
  shapeClass: TrainingShapeClass,
  seed: number
): Point[] {
  const rng = mulberry32(seed);
  return SHAPE_BUILDERS[shapeClass](rng);
}

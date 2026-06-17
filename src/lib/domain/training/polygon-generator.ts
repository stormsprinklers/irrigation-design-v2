import { pointInPolygon, polygonBounds } from "../placement/geometry";
import type { Point } from "../types";
import type {
  GeneratedTrainingPolygon,
  TrainingPolygonMetadata,
  TrainingShapeClass,
} from "./types";

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

function isSimpleEnough(vertices: Point[]): boolean {
  if (vertices.length < 3) return false;
  if (polygonArea(vertices) < 80) return false;
  if (minEdgeLength(vertices) < 4) return false;
  const b = polygonBounds(vertices);
  const test = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  return pointInPolygon(test, vertices);
}

function metadataFor(
  vertices: Point[],
  shapeClass: TrainingShapeClass,
  seed: number
): TrainingPolygonMetadata {
  const b = polygonBounds(vertices);
  return {
    shapeClass,
    seed,
    widthFt: Math.round((b.maxX - b.minX) * 10) / 10,
    heightFt: Math.round((b.maxY - b.minY) * 10) / 10,
    areaSqFt: Math.round(polygonArea(vertices) * 10) / 10,
    vertexCount: vertices.length,
    hasExclusions: false,
  };
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

function irregular(rng: () => number): Point[] {
  const w = randRange(rng, 40, 60);
  const h = randRange(rng, 28, 45);
  const jitter = () => randRange(rng, -3, 3);
  const raw = [
    { x: 0 + jitter(), y: 0 + jitter() },
    { x: w + jitter(), y: 0 + jitter() },
    { x: w + jitter(), y: h * 0.55 + jitter() },
    { x: w * 0.72 + jitter(), y: h * 0.62 + jitter() },
    { x: w * 0.68 + jitter(), y: h + jitter() },
    { x: 0 + jitter(), y: h + jitter() },
  ];
  return ensureCcw(raw);
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
  irregular: irregular,
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

export function generateTrainingPolygon(
  options: PolygonGeneratorOptions = {}
): GeneratedTrainingPolygon {
  const seed = options.seed ?? Math.floor(Math.random() * 1_000_000);
  const rng = mulberry32(seed);
  const shapeClass =
    options.shapeClass ?? ALL_SHAPES[Math.floor(rng() * ALL_SHAPES.length)];

  let vertices = SHAPE_BUILDERS[shapeClass](rng);
  if (!isSimpleEnough(vertices)) {
    vertices = rectangle(45, 30);
    return {
      verticesFt: vertices,
      metadata: metadataFor(vertices, "rectangle", seed),
      exclusionZonesFt: [],
    };
  }

  return {
    verticesFt: vertices,
    metadata: metadataFor(vertices, shapeClass, seed),
    exclusionZonesFt: [],
  };
}

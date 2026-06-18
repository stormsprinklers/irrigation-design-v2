"""
Canonical feature contract for placement ML.
Mirrors src/lib/domain/training/ml-features.ts
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

ML_FEATURE_SPEC_VERSION = 1
ML_MAX_VERTICES = 32
ML_MAX_HEADS = 64
ML_BOUNDARY_GRID_SIZE = 16

SHAPE_CLASSES = [
    "rectangle",
    "l_shape",
    "narrow_strip",
    "concave",
    "front_yard",
    "back_yard",
    "irregular",
]

HEAD_PREFERENCE_INDEX = {
    "SPRAY": 0,
    "ROTOR": 1,
    "MP_ROTATOR": 2,
    "DRIP": 3,
}


@dataclass
class PolygonBbox:
    min_x: float
    min_y: float
    max_x: float
    max_y: float
    width_ft: float
    height_ft: float
    center_x: float
    center_y: float


@dataclass
class NormalizedHeadFeatures:
    head_id: str
    position_norm: tuple[float, float]
    radius_norm: float
    arc_norm: float
    rotation_norm: float
    gpm_norm: float
    precip_norm: float
    catalog_index: int


@dataclass
class MlFeatureTensors:
    spec_version: int
    bbox: PolygonBbox
    vertices_norm: list[tuple[float, float]]
    vertex_mask: list[float]
    edge_lengths_norm: list[float]
    interior_angles_norm: list[float]
    globals: list[float]
    boundary_grid: list[float]
    heads: list[NormalizedHeadFeatures]
    head_mask: list[float]
    head_preference_index: int
    pressure_psi_norm: float
    pattern_index: int
    allowed_catalog_indices: list[int]


def polygon_bounds(vertices: list[dict[str, float]]) -> PolygonBbox:
    xs = [v["x"] for v in vertices]
    ys = [v["y"] for v in vertices]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    width_ft = max(max_x - min_x, 1e-6)
    height_ft = max(max_y - min_y, 1e-6)
    return PolygonBbox(
        min_x=min_x,
        min_y=min_y,
        max_x=max_x,
        max_y=max_y,
        width_ft=width_ft,
        height_ft=height_ft,
        center_x=(min_x + max_x) / 2,
        center_y=(min_y + max_y) / 2,
    )


def normalize_point(p: dict[str, float], bbox: PolygonBbox) -> tuple[float, float]:
    return (
        (p["x"] - bbox.min_x) / bbox.width_ft,
        (p["y"] - bbox.min_y) / bbox.height_ft,
    )


def denormalize_point(xy: tuple[float, float], bbox: PolygonBbox) -> tuple[float, float]:
    return (
        bbox.min_x + xy[0] * bbox.width_ft,
        bbox.min_y + xy[1] * bbox.height_ft,
    )


def interior_angle_deg(prev: dict, vertex: dict, nxt: dict) -> float:
    e1x, e1y = vertex["x"] - prev["x"], vertex["y"] - prev["y"]
    e2x, e2y = nxt["x"] - vertex["x"], nxt["y"] - vertex["y"]
    dot = e1x * e2x + e1y * e2y
    cross = e1x * e2y - e1y * e2x
    return math.degrees(math.atan2(abs(cross), dot))


def polygon_area(vertices: list[dict[str, float]]) -> float:
    area = 0.0
    n = len(vertices)
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i]["x"] * vertices[j]["y"] - vertices[j]["x"] * vertices[i]["y"]
    return abs(area) / 2


def point_in_polygon(point: dict[str, float], vertices: list[dict[str, float]]) -> bool:
    inside = False
    n = len(vertices)
    for i in range(n):
        j = (i - 1) % n
        xi, yi = vertices[i]["x"], vertices[i]["y"]
        xj, yj = vertices[j]["x"], vertices[j]["y"]
        intersect = (yi > point["y"]) != (yj > point["y"]) and point["x"] < (
            (xj - xi) * (point["y"] - yi) / (yj - yi + 1e-9) + xi
        )
        if intersect:
            inside = not inside
    return inside


def distance_to_segment(p: dict, a: dict, b: dict) -> float:
    dx, dy = b["x"] - a["x"], b["y"] - a["y"]
    len_sq = dx * dx + dy * dy
    if len_sq == 0:
        return math.hypot(p["x"] - a["x"], p["y"] - a["y"])
    t = max(0.0, min(1.0, ((p["x"] - a["x"]) * dx + (p["y"] - a["y"]) * dy) / len_sq))
    return math.hypot(p["x"] - (a["x"] + t * dx), p["y"] - (a["y"] + t * dy))


def distance_to_boundary(p: dict, vertices: list[dict[str, float]]) -> float:
    n = len(vertices)
    return min(
        distance_to_segment(p, vertices[i], vertices[(i + 1) % n]) for i in range(n)
    )


def build_catalog_vocab(catalog_item_ids: list[str]) -> dict[str, int]:
    return {cid: i + 1 for i, cid in enumerate(sorted(set(catalog_item_ids)))}


def build_ml_feature_tensors(
    polygon_vertices_ft: list[dict[str, float]],
    shape_class: str,
    baseline_heads: list[dict[str, Any]],
    placement_context: dict[str, Any],
    catalog_vocab: dict[str, int] | None = None,
) -> MlFeatureTensors:
    bbox = polygon_bounds(polygon_vertices_ft)
    scale = max(bbox.width_ft, bbox.height_ft)
    n = len(polygon_vertices_ft)

    if catalog_vocab is None:
        ids = list(placement_context.get("catalogItemIds", []))
        ids.extend(h.get("catalogItemId", "") for h in baseline_heads)
        catalog_vocab = build_catalog_vocab([i for i in ids if i])

    vertices_norm: list[tuple[float, float]] = []
    vertex_mask: list[float] = []
    for i in range(ML_MAX_VERTICES):
        if i < n:
            vertices_norm.append(normalize_point(polygon_vertices_ft[i], bbox))
            vertex_mask.append(1.0)
        else:
            vertices_norm.append((0.0, 0.0))
            vertex_mask.append(0.0)

    edge_lengths_norm: list[float] = []
    for i in range(ML_MAX_VERTICES):
        if i < n:
            a, b = polygon_vertices_ft[i], polygon_vertices_ft[(i + 1) % n]
            edge_lengths_norm.append(
                math.hypot(b["x"] - a["x"], b["y"] - a["y"]) / scale
            )
        else:
            edge_lengths_norm.append(0.0)

    interior_angles_norm: list[float] = []
    for i in range(ML_MAX_VERTICES):
        if i < n:
            prev = polygon_vertices_ft[(i - 1 + n) % n]
            cur = polygon_vertices_ft[i]
            nxt = polygon_vertices_ft[(i + 1) % n]
            interior_angles_norm.append(interior_angle_deg(prev, cur, nxt) / 180.0)
        else:
            interior_angles_norm.append(0.0)

    area = polygon_area(polygon_vertices_ft)
    perimeter = sum(
        math.hypot(
            polygon_vertices_ft[(i + 1) % n]["x"] - polygon_vertices_ft[i]["x"],
            polygon_vertices_ft[(i + 1) % n]["y"] - polygon_vertices_ft[i]["y"],
        )
        for i in range(n)
    )
    compactness = (4 * math.pi * area) / (perimeter * perimeter) if perimeter > 0 else 0.0
    shape_one_hot = [1.0 if s == shape_class else 0.0 for s in SHAPE_CLASSES]
    globals_vec = [
        area / (scale * scale),
        bbox.width_ft / bbox.height_ft,
        compactness,
        n / ML_MAX_VERTICES,
        *shape_one_hot,
    ]

    boundary_grid: list[float] = []
    for row in range(ML_BOUNDARY_GRID_SIZE):
        for col in range(ML_BOUNDARY_GRID_SIZE):
            x = bbox.min_x + ((col + 0.5) / ML_BOUNDARY_GRID_SIZE) * bbox.width_ft
            y = bbox.min_y + ((row + 0.5) / ML_BOUNDARY_GRID_SIZE) * bbox.height_ft
            p = {"x": x, "y": y}
            if not point_in_polygon(p, polygon_vertices_ft):
                boundary_grid.append(0.0)
            else:
                boundary_grid.append(
                    min(1.0, distance_to_boundary(p, polygon_vertices_ft) / scale)
                )

    heads: list[NormalizedHeadFeatures] = []
    head_mask: list[float] = []
    for i in range(ML_MAX_HEADS):
        if i < len(baseline_heads):
            h = baseline_heads[i]
            pos = h["positionFt"]
            heads.append(
                NormalizedHeadFeatures(
                    head_id=h.get("id", ""),
                    position_norm=normalize_point(pos, bbox),
                    radius_norm=h.get("radiusFeet", 0) / scale,
                    arc_norm=h.get("arcDegrees", 360) / 360.0,
                    rotation_norm=h.get("rotationDegrees", 0) / 360.0,
                    gpm_norm=(h.get("gpm") or 0) / 20.0,
                    precip_norm=(h.get("precipInPerHr") or 0) / 2.0,
                    catalog_index=catalog_vocab.get(h.get("catalogItemId", ""), 0),
                )
            )
            head_mask.append(1.0)
        else:
            heads.append(
                NormalizedHeadFeatures("", (0.0, 0.0), 0, 0, 0, 0, 0, 0)
            )
            head_mask.append(0.0)

    ctx = placement_context
    return MlFeatureTensors(
        spec_version=ML_FEATURE_SPEC_VERSION,
        bbox=bbox,
        vertices_norm=vertices_norm,
        vertex_mask=vertex_mask,
        edge_lengths_norm=edge_lengths_norm,
        interior_angles_norm=interior_angles_norm,
        globals=globals_vec,
        boundary_grid=boundary_grid,
        heads=heads,
        head_mask=head_mask,
        head_preference_index=HEAD_PREFERENCE_INDEX.get(ctx.get("headPreference", "ROTOR"), 1),
        pressure_psi_norm=ctx.get("pressurePsi", 65) / 100.0,
        pattern_index=1 if ctx.get("pattern") == "triangular" else 0,
        allowed_catalog_indices=[
            catalog_vocab.get(cid, 0) for cid in ctx.get("catalogItemIds", [])
        ],
    )


def tensors_to_model_arrays(tensors: MlFeatureTensors):
    """Flatten tensors into numpy-friendly arrays for the model."""
    import numpy as np

    poly_vec = (
        [c for xy in tensors.vertices_norm for c in xy]
        + tensors.vertex_mask
        + tensors.edge_lengths_norm
        + tensors.interior_angles_norm
        + tensors.globals
        + tensors.boundary_grid
    )
    head_rows = []
    for h in tensors.heads:
        head_rows.append(
            [
                h.position_norm[0],
                h.position_norm[1],
                h.radius_norm,
                h.arc_norm,
                h.rotation_norm,
                h.gpm_norm,
                h.precip_norm,
                float(h.catalog_index),
            ]
        )
    return {
        "poly": np.array(poly_vec, dtype=np.float32),
        "heads": np.array(head_rows, dtype=np.float32),
        "head_mask": np.array(tensors.head_mask, dtype=np.float32),
        "context": np.array(
            [
                tensors.head_preference_index,
                tensors.pressure_psi_norm,
                tensors.pattern_index,
            ],
            dtype=np.float32,
        ),
        "bbox": tensors.bbox,
    }

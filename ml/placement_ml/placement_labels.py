"""Full-layout training labels and inference decoding (model v2)."""
from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from typing import Any

import numpy as np

from .features import ML_MAX_HEADS, PolygonBbox, build_ml_feature_tensors, normalize_point


@dataclass
class PlacementSlotLabels:
    exist: list[float]
    pos_norm: list[tuple[float, float]]
    radius_norm: list[float]
    arc_norm: list[float]
    rotation_norm: list[float]
    nozzle_index: list[float]
    body_index: list[float]


def _sort_heads(heads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        heads,
        key=lambda h: (h["positionFt"]["y"], h["positionFt"]["x"]),
    )


def compute_placement_labels(
    approved_heads: list[dict[str, Any]],
    bbox: PolygonBbox,
    nozzle_vocab: dict[str, int],
    body_vocab: dict[str, int],
) -> PlacementSlotLabels:
    scale = max(bbox.width_ft, bbox.height_ft)
    sorted_heads = _sort_heads(approved_heads)[:ML_MAX_HEADS]

    exist: list[float] = []
    pos_norm: list[tuple[float, float]] = []
    radius_norm: list[float] = []
    arc_norm: list[float] = []
    rotation_norm: list[float] = []
    nozzle_index: list[float] = []
    body_index: list[float] = []

    for i in range(ML_MAX_HEADS):
        if i < len(sorted_heads):
            h = sorted_heads[i]
            exist.append(1.0)
            pos_norm.append(normalize_point(h["positionFt"], bbox))
            radius_norm.append(h.get("radiusFeet", 12.0) / scale)
            arc_norm.append(h.get("arcDegrees", 360.0) / 360.0)
            rotation_norm.append(h.get("rotationDegrees", 0.0) / 360.0)
            nozzle_index.append(float(nozzle_vocab.get(h.get("catalogItemId", ""), 0)))
            body_index.append(float(body_vocab.get(h.get("headBodyId") or "", 0)))
        else:
            exist.append(0.0)
            pos_norm.append((0.0, 0.0))
            radius_norm.append(0.0)
            arc_norm.append(0.0)
            rotation_norm.append(0.0)
            nozzle_index.append(0.0)
            body_index.append(0.0)

    return PlacementSlotLabels(
        exist=exist,
        pos_norm=pos_norm,
        radius_norm=radius_norm,
        arc_norm=arc_norm,
        rotation_norm=rotation_norm,
        nozzle_index=nozzle_index,
        body_index=body_index,
    )


def placement_labels_to_arrays(labels: PlacementSlotLabels) -> dict[str, np.ndarray]:
    return {
        "exist": np.array(labels.exist, dtype=np.float32),
        "pos": np.array(labels.pos_norm, dtype=np.float32),
        "radius": np.array(labels.radius_norm, dtype=np.float32).reshape(-1, 1),
        "arc": np.array(labels.arc_norm, dtype=np.float32).reshape(-1, 1),
        "rotation": np.array(labels.rotation_norm, dtype=np.float32).reshape(-1, 1),
        "nozzle": np.array(labels.nozzle_index, dtype=np.float32),
        "body": np.array(labels.body_index, dtype=np.float32),
    }


def build_placement_training_sample(
    record,
    nozzle_vocab: dict[str, int],
    body_vocab: dict[str, int],
):
    tensors = build_ml_feature_tensors(
        record.polygon_vertices_ft,
        record.shape_class,
        record.algorithm_output,
        record.placement_context,
        nozzle_vocab,
    )
    labels = compute_placement_labels(
        record.approved_output,
        tensors.bbox,
        nozzle_vocab,
        body_vocab,
    )
    from .features import tensors_to_model_arrays

    arrays = tensors_to_model_arrays(tensors)
    label_arrays = placement_labels_to_arrays(labels)
    return {**arrays, **label_arrays, "record_id": record.id, "bbox": tensors.bbox}


def _lookup_vocab_index(index: float, reverse_vocab: dict[int, str], fallback: str | None) -> str:
    idx = int(round(float(index)))
    return reverse_vocab.get(idx) or fallback or ""


def decode_placed_heads(
    exist_logit: np.ndarray,
    pos: np.ndarray,
    radius: np.ndarray,
    arc: np.ndarray,
    rotation: np.ndarray,
    nozzle: np.ndarray,
    body: np.ndarray,
    bbox: PolygonBbox,
    nozzle_vocab: dict[str, int],
    body_vocab: dict[str, int],
    *,
    exist_threshold: float = 0.45,
    default_nozzle_id: str | None = None,
    default_body_id: str | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    reverse_nozzle = {v: k for k, v in nozzle_vocab.items()}
    reverse_body = {v: k for k, v in body_vocab.items()}
    scale = max(bbox.width_ft, bbox.height_ft)
    heads: list[dict[str, Any]] = []
    confidences: list[float] = []

    for i in range(len(exist_logit)):
        prob = float(1.0 / (1.0 + math.exp(-float(exist_logit[i]))))
        if prob < exist_threshold:
            continue

        x = bbox.min_x + float(pos[i, 0]) * bbox.width_ft
        y = bbox.min_y + float(pos[i, 1]) * bbox.height_ft
        radius_ft = max(1.0, float(radius[i, 0]) * scale)
        arc_deg = max(1.0, min(360.0, float(arc[i, 0]) * 360.0))
        rot_deg = float(rotation[i, 0]) * 360.0 % 360.0
        nozzle_id = _lookup_vocab_index(nozzle[i], reverse_nozzle, default_nozzle_id)
        body_id = _lookup_vocab_index(body[i], reverse_body, default_body_id) or None

        wedge_start = (rot_deg - arc_deg / 2) % 360
        wedge_end = (wedge_start + arc_deg) % 360

        heads.append(
            {
                "id": f"head-ml-{uuid.uuid4().hex[:12]}",
                "positionFt": {"x": x, "y": y},
                "radiusFeet": radius_ft,
                "arcDegrees": arc_deg,
                "rotationDegrees": rot_deg,
                "wedgeStartDeg": wedge_start,
                "wedgeEndDeg": wedge_end if arc_deg < 359.5 else 360.0,
                "catalogItemId": nozzle_id,
                "headBodyId": body_id,
                "nozzleModel": None,
                "gpm": None,
                "precipInPerHr": None,
            }
        )
        confidences.append(prob)

    diagnostics = {
        "deletedIds": [],
        "addedHeads": heads,
        "meanConfidence": float(np.mean(confidences)) if confidences else 0.0,
        "appliedDeltas": [],
        "modelType": "v2",
        "predictedHeadCount": len(heads),
    }
    return heads, diagnostics

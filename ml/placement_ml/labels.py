"""Derive training labels from editLog and approvedOutput."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np

from .features import ML_MAX_HEADS, PolygonBbox, build_ml_feature_tensors, denormalize_point


@dataclass
class HeadLabels:
    delta_xy_norm: tuple[float, float]
    moved: bool
    deleted: bool


@dataclass
class ExampleLabels:
    head_labels: list[HeadLabels]
    head_mask: list[float]


def _head_map(heads: list[dict[str, Any]]) -> dict[str, dict]:
    return {h["id"]: h for h in heads}


def compute_labels(
    baseline: list[dict[str, Any]],
    approved: list[dict[str, Any]],
    edit_log: dict[str, Any] | None,
    bbox: PolygonBbox,
    move_threshold_ft: float = 0.5,
) -> ExampleLabels:
    approved_map = _head_map(approved)
    deleted_ids = set((edit_log or {}).get("deleted", []))
    moved_by_id = {m["id"]: m for m in (edit_log or {}).get("moved", [])}

    scale = max(bbox.width_ft, bbox.height_ft)
    head_labels: list[HeadLabels] = []
    head_mask: list[float] = []

    for i in range(ML_MAX_HEADS):
        if i >= len(baseline):
            head_labels.append(HeadLabels((0.0, 0.0), False, False))
            head_mask.append(0.0)
            continue

        b = baseline[i]
        hid = b["id"]
        head_mask.append(1.0)

        if hid in deleted_ids or hid not in approved_map:
            head_labels.append(HeadLabels((0.0, 0.0), False, True))
            continue

        a = approved_map[hid]
        bp, ap = b["positionFt"], a["positionFt"]
        dx_ft = ap["x"] - bp["x"]
        dy_ft = ap["y"] - bp["y"]
        delta_ft = math.hypot(dx_ft, dy_ft)

        if hid in moved_by_id or delta_ft >= move_threshold_ft:
            head_labels.append(
                HeadLabels((dx_ft / scale, dy_ft / scale), True, False)
            )
        else:
            head_labels.append(HeadLabels((0.0, 0.0), False, False))

    return ExampleLabels(head_labels=head_labels, head_mask=head_mask)


def labels_to_arrays(labels: ExampleLabels) -> dict[str, np.ndarray]:
    deltas = np.array(
        [[hl.delta_xy_norm[0], hl.delta_xy_norm[1]] for hl in labels.head_labels],
        dtype=np.float32,
    )
    moved = np.array([1.0 if hl.moved else 0.0 for hl in labels.head_labels], dtype=np.float32)
    deleted = np.array([1.0 if hl.deleted else 0.0 for hl in labels.head_labels], dtype=np.float32)
    mask = np.array(labels.head_mask, dtype=np.float32)
    return {"delta_xy": deltas, "moved": moved, "deleted": deleted, "mask": mask}


def build_training_sample(record, catalog_vocab: dict[str, int]):
    tensors = build_ml_feature_tensors(
        record.polygon_vertices_ft,
        record.shape_class,
        record.algorithm_output,
        record.placement_context,
        catalog_vocab,
    )
    labels = compute_labels(
        record.algorithm_output,
        record.approved_output,
        record.edit_log,
        tensors.bbox,
    )
    from .features import tensors_to_model_arrays

    arrays = tensors_to_model_arrays(tensors)
    label_arrays = labels_to_arrays(labels)
    return {**arrays, **label_arrays, "record_id": record.id, "bbox": tensors.bbox}


def apply_predicted_deltas(
    baseline_heads: list[dict[str, Any]],
    delta_xy_norm: np.ndarray,
    delete_prob: np.ndarray,
    bbox: PolygonBbox,
    *,
    delete_threshold: float = 0.5,
    max_delta_ft: float = 15.0,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    scale = max(bbox.width_ft, bbox.height_ft)
    refined: list[dict[str, Any]] = []
    deleted_ids: list[str] = []
    applied: list[dict[str, Any]] = []
    confidences: list[float] = []

    for i, head in enumerate(baseline_heads):
        if i >= len(delta_xy_norm):
            refined.append(head)
            continue
        del_p = float(delete_prob[i])
        confidences.append(1.0 - del_p)
        if del_p >= delete_threshold:
            deleted_ids.append(head["id"])
            applied.append(
                {"id": head["id"], "dxFt": 0, "dyFt": 0, "deleteProb": del_p}
            )
            continue

        dx_ft = float(delta_xy_norm[i, 0]) * scale
        dy_ft = float(delta_xy_norm[i, 1]) * scale
        mag = math.hypot(dx_ft, dy_ft)
        if mag > max_delta_ft:
            scale_factor = max_delta_ft / mag
            dx_ft *= scale_factor
            dy_ft *= scale_factor

        pos = head["positionFt"]
        new_pos = {"x": pos["x"] + dx_ft, "y": pos["y"] + dy_ft}
        refined.append({**head, "positionFt": new_pos})
        applied.append(
            {"id": head["id"], "dxFt": dx_ft, "dyFt": dy_ft, "deleteProb": del_p}
        )

    diagnostics = {
        "deletedIds": deleted_ids,
        "addedHeads": [],
        "meanConfidence": float(np.mean(confidences)) if confidences else 1.0,
        "appliedDeltas": applied,
    }
    return refined, diagnostics

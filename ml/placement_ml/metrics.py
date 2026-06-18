"""Evaluation metrics for placement correction models."""
from __future__ import annotations

import math
from typing import Any

import numpy as np


def position_mae_ft(
    pred_heads: list[dict[str, Any]],
    target_heads: list[dict[str, Any]],
    baseline_heads: list[dict[str, Any]],
) -> float:
    target_map = {h["id"]: h for h in target_heads}
    baseline_map = {h["id"]: h for h in baseline_heads}
    errors: list[float] = []

    for head in pred_heads:
        hid = head["id"]
        if hid not in target_map:
            continue
        tp = target_map[hid]["positionFt"]
        pp = head["positionFt"]
        errors.append(math.hypot(tp["x"] - pp["x"], tp["y"] - pp["y"]))

    for hid, target in target_map.items():
        if hid not in {h["id"] for h in pred_heads} and hid in baseline_map:
            bp = baseline_map[hid]["positionFt"]
            tp = target["positionFt"]
            errors.append(math.hypot(tp["x"] - bp["x"], tp["y"] - bp["y"]))

    return float(np.mean(errors)) if errors else 0.0


def head_count_delta(pred: list, target: list) -> int:
    return abs(len(pred) - len(target))


def delete_f1(pred_deleted: set[str], true_deleted: set[str]) -> float:
    if not true_deleted and not pred_deleted:
        return 1.0
    tp = len(pred_deleted & true_deleted)
    prec = tp / len(pred_deleted) if pred_deleted else 0.0
    rec = tp / len(true_deleted) if true_deleted else 0.0
    if prec + rec == 0:
        return 0.0
    return 2 * prec * rec / (prec + rec)


def summarize_geometric_metrics(
    records: list,
    predictions: list[list[dict[str, Any]]],
) -> dict[str, float]:
    maes: list[float] = []
    count_deltas: list[int] = []
    f1s: list[float] = []

    for record, pred_heads in zip(records, predictions):
        mae = position_mae_ft(pred_heads, record.approved_output, record.algorithm_output)
        maes.append(mae)
        count_deltas.append(head_count_delta(pred_heads, record.approved_output))

        true_deleted = set((record.edit_log or {}).get("deleted", []))
        pred_deleted = {h["id"] for h in record.algorithm_output} - {h["id"] for h in pred_heads}
        f1s.append(delete_f1(pred_deleted, true_deleted))

    return {
        "position_mae_ft_mean": float(np.mean(maes)) if maes else 0.0,
        "position_mae_ft_median": float(np.median(maes)) if maes else 0.0,
        "head_count_delta_mean": float(np.mean(count_deltas)) if count_deltas else 0.0,
        "delete_f1_mean": float(np.mean(f1s)) if f1s else 0.0,
    }


def improvement_score_proxy(
    baseline_score: float,
    candidate_score: float,
) -> float:
    """Matches training improvement when scores are precomputed."""
    return candidate_score - baseline_score


def per_shape_breakdown(records, metric_by_id: dict[str, float]) -> dict[str, dict[str, float]]:
    by_shape: dict[str, list[float]] = {}
    for r in records:
        by_shape.setdefault(r.shape_class, []).append(metric_by_id.get(r.id, 0.0))
    return {
        shape: {
            "count": len(vals),
            "mean": float(np.mean(vals)) if vals else 0.0,
            "median": float(np.median(vals)) if vals else 0.0,
        }
        for shape, vals in by_shape.items()
    }

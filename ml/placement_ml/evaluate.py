#!/usr/bin/env python3
"""Evaluate placement model v1 or v2 on held-out split."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from placement_ml.dataset import filter_records, load_jsonl, load_manifest
from placement_ml.features import build_ml_feature_tensors, tensors_to_model_arrays
from placement_ml.labels import apply_predicted_deltas
from placement_ml.model_v1 import PlacementCorrectionModelV1
from placement_ml.model_v2 import PlacementModelV2
from placement_ml.metrics import summarize_geometric_metrics
from placement_ml.placement_labels import decode_placed_heads


def predict_record_v1(model, record, catalog_vocab, device):
    tensors = build_ml_feature_tensors(
        record.polygon_vertices_ft,
        record.shape_class,
        record.algorithm_output,
        record.placement_context,
        catalog_vocab,
    )
    arrays = tensors_to_model_arrays(tensors)
    poly = torch.tensor(arrays["poly"]).unsqueeze(0).to(device)
    heads = torch.tensor(arrays["heads"]).unsqueeze(0).to(device)
    context = torch.tensor(arrays["context"]).unsqueeze(0).to(device)
    mask = torch.tensor(arrays["head_mask"]).unsqueeze(0).to(device)

    with torch.no_grad():
        delta, delete_logit = model(poly, heads, context, mask)
    delete_prob = torch.sigmoid(delete_logit).cpu().numpy()[0]
    delta_np = delta.cpu().numpy()[0]

    refined, _ = apply_predicted_deltas(
        record.algorithm_output,
        delta_np,
        delete_prob,
        tensors.bbox,
    )
    return refined


def predict_record_v2(model, record, nozzle_vocab, body_vocab, device):
    tensors = build_ml_feature_tensors(
        record.polygon_vertices_ft,
        record.shape_class,
        record.algorithm_output,
        record.placement_context,
        nozzle_vocab,
    )
    arrays = tensors_to_model_arrays(tensors)
    poly = torch.tensor(arrays["poly"]).unsqueeze(0).to(device)
    heads = torch.tensor(arrays["heads"]).unsqueeze(0).to(device)
    context = torch.tensor(arrays["context"]).unsqueeze(0).to(device)
    mask = torch.tensor(arrays["head_mask"]).unsqueeze(0).to(device)

    with torch.no_grad():
        exist_logit, pos, radius, arc, rotation, nozzle, body = model(
            poly, heads, context, mask
        )

    default_nozzle = None
    catalog_ids = record.placement_context.get("catalogItemIds") or []
    if catalog_ids:
        default_nozzle = catalog_ids[0]

    placed, _ = decode_placed_heads(
        exist_logit.cpu().numpy()[0],
        pos.cpu().numpy()[0],
        radius.cpu().numpy()[0],
        arc.cpu().numpy()[0],
        rotation.cpu().numpy()[0],
        nozzle.cpu().numpy()[0],
        body.cpu().numpy()[0],
        tensors.bbox,
        nozzle_vocab,
        body_vocab,
        default_nozzle_id=default_nozzle,
    )
    return placed


def main():
    parser = argparse.ArgumentParser(description="Evaluate placement model")
    parser.add_argument("--data", required=True)
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--manifest", default=None)
    parser.add_argument("--split", default="all", choices=["train", "val", "test", "all"])
    parser.add_argument("--algorithm-version", default=None)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--output", default=None, help="Write metrics JSON")
    args = parser.parse_args()

    ckpt = torch.load(args.checkpoint, map_location=args.device, weights_only=False)
    nozzle_vocab = ckpt.get("catalog_vocab", {})
    body_vocab = ckpt.get("body_vocab", {})
    model_type = ckpt.get("model_type", "v1")

    if model_type == "v2":
        model = PlacementModelV2(poly_dim=ckpt["poly_dim"]).to(args.device)
        predict_fn = lambda m, r, d: predict_record_v2(m, r, nozzle_vocab, body_vocab, d)
    else:
        model = PlacementCorrectionModelV1(poly_dim=ckpt["poly_dim"]).to(args.device)
        predict_fn = predict_record_v1

    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    records = load_jsonl(args.data)
    manifest = load_manifest(args.manifest) if args.manifest else None
    eval_records = filter_records(
        records,
        valid_for_training_only=False,
        algorithm_version=args.algorithm_version,
        split=args.split,
        manifest=manifest,
    )

    predictions = [predict_fn(model, r, args.device) for r in eval_records]

    baseline_maes = []
    model_maes = []
    improvement_deltas = []

    for record, pred in zip(eval_records, predictions):
        from placement_ml.metrics import position_mae_ft

        baseline_mae = position_mae_ft(
            record.algorithm_output, record.approved_output, record.algorithm_output
        )
        model_mae = position_mae_ft(pred, record.approved_output, record.algorithm_output)
        baseline_maes.append(baseline_mae)
        model_maes.append(model_mae)
        improvement_deltas.append(baseline_mae - model_mae)

    metrics = summarize_geometric_metrics(eval_records, predictions)
    metrics["n_examples"] = len(eval_records)
    metrics["baseline_position_mae_ft_mean"] = float(np.mean(baseline_maes)) if baseline_maes else 0.0
    metrics["model_position_mae_ft_mean"] = float(np.mean(model_maes)) if model_maes else 0.0
    metrics["model_beats_baseline_mae"] = metrics["model_position_mae_ft_mean"] < metrics[
        "baseline_position_mae_ft_mean"
    ]
    metrics["model_type"] = model_type

    print(json.dumps(metrics, indent=2))
    if args.output:
        Path(args.output).write_text(json.dumps(metrics, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Evaluate placement correction model on held-out split."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from placement_ml.dataset import filter_records, load_jsonl, load_manifest
from placement_ml.features import build_ml_feature_tensors, tensors_to_model_arrays
from placement_ml.labels import apply_predicted_deltas
from placement_ml.metrics import summarize_geometric_metrics
from placement_ml.model_v1 import PlacementCorrectionModelV1


def predict_record(model, record, catalog_vocab, device):
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


def main():
    parser = argparse.ArgumentParser(description="Evaluate placement correction model")
    parser.add_argument("--data", required=True)
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--manifest", default=None)
    parser.add_argument("--split", default="test", choices=["train", "val", "test"])
    parser.add_argument("--algorithm-version", default=None)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--output", default=None, help="Write metrics JSON")
    args = parser.parse_args()

    ckpt = torch.load(args.checkpoint, map_location=args.device, weights_only=False)
    vocab = ckpt.get("catalog_vocab", {})
    model = PlacementCorrectionModelV1(poly_dim=ckpt["poly_dim"]).to(args.device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    records = load_jsonl(args.data)
    manifest = load_manifest(args.manifest) if args.manifest else None
    eval_records = filter_records(
        records,
        valid_for_training_only=True,
        algorithm_version=args.algorithm_version,
        split=args.split,
        manifest=manifest,
    )

    predictions = [predict_record(model, r, vocab, args.device) for r in eval_records]

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
        improvement_deltas.append(record.improvement_score)

    geom = summarize_geometric_metrics(eval_records, predictions)
    metrics = {
        **geom,
        "n_examples": len(eval_records),
        "baseline_position_mae_ft_mean": float(np.mean(baseline_maes)) if baseline_maes else 0,
        "model_position_mae_ft_mean": float(np.mean(model_maes)) if model_maes else 0,
        "median_improvement_score_in_dataset": float(np.median(improvement_deltas))
        if improvement_deltas
        else 0,
        "model_beats_baseline_mae": float(np.mean(model_maes)) < float(np.mean(baseline_maes))
        if model_maes
        else False,
    }

    print(json.dumps(metrics, indent=2))
    if args.output:
        Path(args.output).write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

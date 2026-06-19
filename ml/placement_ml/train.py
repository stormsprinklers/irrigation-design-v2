#!/usr/bin/env python3
"""Train placement model v1 (correction) or v2 (full layout)."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset

from placement_ml.dataset import (
    build_body_vocab_from_records,
    build_catalog_vocab_from_records,
    filter_records,
    load_jsonl,
    load_manifest,
)
from placement_ml.labels import build_training_sample
from placement_ml.model_v1 import PlacementCorrectionModelV1, correction_loss
from placement_ml.model_v2 import PlacementModelV2, placement_loss
from placement_ml.placement_labels import build_placement_training_sample


class CorrectionDataset(Dataset):
    def __init__(self, records, catalog_vocab):
        self.samples = [build_training_sample(r, catalog_vocab) for r in records]

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        s = self.samples[idx]
        return {
            "poly": torch.tensor(s["poly"]),
            "heads": torch.tensor(s["heads"]),
            "context": torch.tensor(s["context"]),
            "head_mask": torch.tensor(s["mask"]),
            "delta_xy": torch.tensor(s["delta_xy"]),
            "moved": torch.tensor(s["moved"]),
            "deleted": torch.tensor(s["deleted"]),
        }


class PlacementDataset(Dataset):
    def __init__(self, records, nozzle_vocab, body_vocab):
        self.samples = [
            build_placement_training_sample(r, nozzle_vocab, body_vocab) for r in records
        ]

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        s = self.samples[idx]
        return {
            "poly": torch.tensor(s["poly"]),
            "heads": torch.tensor(s["heads"]),
            "context": torch.tensor(s["context"]),
            "head_mask": torch.tensor(s["mask"]),
            "exist": torch.tensor(s["exist"]),
            "pos": torch.tensor(s["pos"]),
            "radius": torch.tensor(s["radius"]),
            "arc": torch.tensor(s["arc"]),
            "rotation": torch.tensor(s["rotation"]),
            "nozzle": torch.tensor(s["nozzle"]),
            "body": torch.tensor(s["body"]),
        }


def collate(batch):
    return {k: torch.stack([b[k] for b in batch]) for k in batch[0]}


def run_epoch_v1(model, loader, optimizer, device, train: bool):
    model.train(train)
    total_loss = 0.0
    n = 0
    for batch in loader:
        batch = {k: v.to(device) for k, v in batch.items()}
        with torch.set_grad_enabled(train):
            pred_delta, pred_delete = model(
                batch["poly"], batch["heads"], batch["context"], batch["head_mask"]
            )
            loss = correction_loss(
                pred_delta,
                pred_delete,
                batch["delta_xy"],
                batch["moved"],
                batch["deleted"],
                batch["head_mask"],
            )
            if train:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
        total_loss += float(loss.item()) * len(batch["poly"])
        n += len(batch["poly"])
    return total_loss / max(n, 1)


def run_epoch_v2(model, loader, optimizer, device, train: bool):
    model.train(train)
    total_loss = 0.0
    n = 0
    for batch in loader:
        batch = {k: v.to(device) for k, v in batch.items()}
        with torch.set_grad_enabled(train):
            pred_exist, pred_pos, pred_radius, pred_arc, pred_rot, pred_nozzle, pred_body = model(
                batch["poly"], batch["heads"], batch["context"], batch["head_mask"]
            )
            loss = placement_loss(
                pred_exist,
                pred_pos,
                pred_radius,
                pred_arc,
                pred_rot,
                pred_nozzle,
                pred_body,
                batch["exist"],
                batch["pos"],
                batch["radius"],
                batch["arc"],
                batch["rotation"],
                batch["nozzle"],
                batch["body"],
            )
            if train:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
        total_loss += float(loss.item()) * len(batch["poly"])
        n += len(batch["poly"])
    return total_loss / max(n, 1)


def main():
    parser = argparse.ArgumentParser(description="Train placement ML model")
    parser.add_argument("--data", required=True, help="Path to slim JSONL export")
    parser.add_argument("--manifest", default=None, help="Optional split manifest JSON")
    parser.add_argument("--output", default="ml/checkpoints", help="Checkpoint output dir")
    parser.add_argument("--model", choices=["v1", "v2"], default="v2", help="Model architecture")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--algorithm-version", default=None)
    parser.add_argument("--device", default="cpu")
    args = parser.parse_args()

    records = load_jsonl(args.data)
    manifest = load_manifest(args.manifest) if args.manifest else None
    train_records = filter_records(
        records,
        valid_for_training_only=False,
        algorithm_version=args.algorithm_version,
        split="train",
        manifest=manifest,
    )
    val_records = filter_records(
        records,
        valid_for_training_only=False,
        algorithm_version=args.algorithm_version,
        split="val",
        manifest=manifest,
    )

    if not train_records:
        raise SystemExit("No training records after filtering")

    nozzle_vocab = build_catalog_vocab_from_records(records)
    body_vocab = build_body_vocab_from_records(records)
    if args.model == "v2":
        train_ds = PlacementDataset(train_records, nozzle_vocab, body_vocab)
        val_ds = PlacementDataset(val_records, nozzle_vocab, body_vocab) if val_records else None
        run_epoch = run_epoch_v2
        ModelCls = PlacementModelV2
    else:
        train_ds = CorrectionDataset(train_records, nozzle_vocab)
        val_ds = CorrectionDataset(val_records, nozzle_vocab) if val_records else None
        run_epoch = run_epoch_v1
        ModelCls = PlacementCorrectionModelV1

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, collate_fn=collate)
    val_loader = (
        DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, collate_fn=collate)
        if val_ds
        else None
    )

    poly_dim = train_ds[0]["poly"].shape[0]
    model = ModelCls(poly_dim=poly_dim).to(args.device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    best_val = float("inf")
    history = []

    for epoch in range(1, args.epochs + 1):
        train_loss = run_epoch(model, train_loader, optimizer, args.device, train=True)
        val_loss = (
            run_epoch(model, val_loader, optimizer, args.device, train=False)
            if val_loader
            else train_loss
        )
        history.append({"epoch": epoch, "train_loss": train_loss, "val_loss": val_loss})
        print(f"epoch {epoch}: train={train_loss:.4f} val={val_loss:.4f}")

        if val_loss < best_val:
            best_val = val_loss
            ckpt = {
                "model_type": args.model,
                "model_state_dict": model.state_dict(),
                "poly_dim": poly_dim,
                "catalog_vocab": nozzle_vocab,
                "body_vocab": body_vocab,
                "epoch": epoch,
                "val_loss": val_loss,
            }
            torch.save(ckpt, output_dir / "best.pt")

    with open(output_dir / "feature_vocab.json", "w", encoding="utf-8") as f:
        json.dump(
            {"catalog_vocab": nozzle_vocab, "body_vocab": body_vocab, "model_type": args.model},
            f,
            indent=2,
        )
    with open(output_dir / "training_history.json", "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)
    print(f"Saved {args.model} checkpoint to {output_dir / 'best.pt'}")


if __name__ == "__main__":
    main()

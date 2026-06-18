#!/usr/bin/env python3
"""Train placement correction model v1."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset

from placement_ml.dataset import build_catalog_vocab_from_records, filter_records, load_jsonl, load_manifest
from placement_ml.labels import build_training_sample
from placement_ml.model_v1 import PlacementCorrectionModelV1, correction_loss


class PlacementDataset(Dataset):
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


def collate(batch):
    return {k: torch.stack([b[k] for b in batch]) for k in batch[0]}


def run_epoch(model, loader, optimizer, device, train: bool):
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


def main():
    parser = argparse.ArgumentParser(description="Train placement correction model")
    parser.add_argument("--data", required=True, help="Path to slim JSONL export")
    parser.add_argument("--manifest", default=None, help="Optional split manifest JSON")
    parser.add_argument("--output", default="ml/checkpoints", help="Checkpoint output dir")
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
        valid_for_training_only=True,
        algorithm_version=args.algorithm_version,
        split="train",
        manifest=manifest,
    )
    val_records = filter_records(
        records,
        valid_for_training_only=True,
        algorithm_version=args.algorithm_version,
        split="val",
        manifest=manifest,
    )

    if not train_records:
        raise SystemExit("No training records after filtering")

    vocab = build_catalog_vocab_from_records(records)
    train_ds = PlacementDataset(train_records, vocab)
    val_ds = PlacementDataset(val_records, vocab) if val_records else None

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, collate_fn=collate)
    val_loader = (
        DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, collate_fn=collate)
        if val_ds
        else None
    )

    poly_dim = train_ds[0]["poly"].shape[0]
    model = PlacementCorrectionModelV1(poly_dim=poly_dim).to(args.device)
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
                "model_state_dict": model.state_dict(),
                "poly_dim": poly_dim,
                "catalog_vocab": vocab,
                "epoch": epoch,
                "val_loss": val_loss,
            }
            torch.save(ckpt, output_dir / "best.pt")

    with open(output_dir / "feature_vocab.json", "w", encoding="utf-8") as f:
        json.dump({"catalog_vocab": vocab}, f, indent=2)
    with open(output_dir / "training_history.json", "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)
    print(f"Saved checkpoint to {output_dir / 'best.pt'}")


if __name__ == "__main__":
    main()

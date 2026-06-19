"""Load JSONL training records and build train/val/test splits."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

SplitName = Literal["train", "val", "test"]


@dataclass
class TrainingRecord:
    id: str
    algorithm_version: str
    shape_class: str
    seed: int
    polygon_vertices_ft: list[dict[str, float]]
    polygon_metadata: dict[str, Any]
    exclusion_zones_ft: list[Any]
    placement_context: dict[str, Any]
    algorithm_output: list[dict[str, Any]]
    approved_output: list[dict[str, Any]]
    edit_log: dict[str, Any] | None
    improvement_score: float
    valid_for_training: bool

    @classmethod
    def from_json(cls, obj: dict[str, Any]) -> "TrainingRecord":
        if "payload" in obj:
            p = obj["payload"]
            meta = p["polygonMetadata"]
            return cls(
                id=obj["id"],
                algorithm_version=obj.get("algorithmVersion", p.get("algorithmVersion", "")),
                shape_class=meta["shapeClass"],
                seed=meta["seed"],
                polygon_vertices_ft=p["polygonVerticesFt"],
                polygon_metadata=meta,
                exclusion_zones_ft=p.get("exclusionZonesFt", []),
                placement_context=p["placementContext"],
                algorithm_output=p["algorithmOutput"],
                approved_output=p["approvedOutput"],
                edit_log=p.get("editLog"),
                improvement_score=p.get("improvementScore", 0),
                valid_for_training=obj.get("validForTraining", p.get("validForTraining", True)) is not False,
            )
        return cls(
            id=obj["id"],
            algorithm_version=obj["algorithmVersion"],
            shape_class=obj["shapeClass"],
            seed=obj["seed"],
            polygon_vertices_ft=obj["polygonVerticesFt"],
            polygon_metadata=obj["polygonMetadata"],
            exclusion_zones_ft=obj.get("exclusionZonesFt", []),
            placement_context=obj["placementContext"],
            algorithm_output=obj["algorithmOutput"],
            approved_output=obj["approvedOutput"],
            edit_log=obj.get("editLog"),
            improvement_score=obj.get("improvementScore", 0),
            valid_for_training=obj.get("validForTraining", True) is not False,
        )


def seed_split_bucket(seed: int) -> SplitName:
    bucket = abs(seed) % 100
    if bucket < 70:
        return "train"
    if bucket < 85:
        return "val"
    return "test"


def load_jsonl(path: str | Path) -> list[TrainingRecord]:
    records: list[TrainingRecord] = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records.append(TrainingRecord.from_json(json.loads(line)))
    return records


def load_manifest(path: str | Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def filter_records(
    records: list[TrainingRecord],
    *,
    valid_for_training_only: bool = False,
    algorithm_version: str | None = None,
    split: SplitName | str | None = None,
    manifest: dict[str, Any] | None = None,
) -> list[TrainingRecord]:
    out: list[TrainingRecord] = []
    for r in records:
        if valid_for_training_only and r.valid_for_training is False:
            continue
        if algorithm_version and r.algorithm_version != algorithm_version:
            continue
        if split and split != "all":
            if manifest:
                allowed = set(manifest.get("splits", {}).get(split, []))
                if r.id not in allowed:
                    continue
            elif seed_split_bucket(r.seed) != split:
                continue
        out.append(r)
    return out


def build_catalog_vocab_from_records(records: list[TrainingRecord]) -> dict[str, int]:
    """Nozzle catalog item IDs (catalogItemId on each head)."""
    ids: set[str] = set()
    for r in records:
        for h in r.algorithm_output + r.approved_output:
            cid = h.get("catalogItemId")
            if cid:
                ids.add(cid)
        for cid in r.placement_context.get("catalogItemIds", []):
            ids.add(cid)
    return {cid: i + 1 for i, cid in enumerate(sorted(ids))}


def build_body_vocab_from_records(records: list[TrainingRecord]) -> dict[str, int]:
    """Spray/rotor body catalog item IDs (headBodyId on each head)."""
    ids: set[str] = set()
    for r in records:
        for h in r.algorithm_output + r.approved_output:
            bid = h.get("headBodyId")
            if bid:
                ids.add(bid)
    return {bid: i + 1 for i, bid in enumerate(sorted(ids))}

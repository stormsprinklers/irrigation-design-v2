#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${1:-training-export.jsonl}"
MANIFEST="${2:-training-split-manifest.json}"

cd "$ROOT"
npm run training:export -- --output "$DATA" --manifest "$MANIFEST"

cd ml
pip install -e .
python -m placement_ml.train --data "../$DATA" --manifest "../$MANIFEST" --output checkpoints
python -m placement_ml.evaluate --data "../$DATA" --checkpoint checkpoints/best.pt --manifest "../$MANIFEST" --output checkpoints/eval_metrics.json

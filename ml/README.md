# Placement ML

Offline training and inference service for sprinkler head placement correction.

## Setup

```bash
cd ml
pip install -e .
```

## Export training data (from repo root)

```bash
npm run training:export -- --output training-export.jsonl --manifest training-split-manifest.json
```

## Train

```bash
python -m placement_ml.train \
  --data ../training-export.jsonl \
  --manifest ../training-split-manifest.json \
  --output checkpoints
```

## Evaluate

```bash
python -m placement_ml.evaluate \
  --data ../training-export.jsonl \
  --checkpoint checkpoints/best.pt \
  --manifest ../training-split-manifest.json \
  --split test \
  --output checkpoints/eval_metrics.json
```

## Run inference API locally

```bash
export ML_CHECKPOINT_PATH=checkpoints/best.pt
export ML_API_KEY=dev-secret
uvicorn serve.app:app --reload --port 8000
```

```bash
curl -X POST http://localhost:8000/v1/refine \
  -H "Content-Type: application/json" \
  -H "X-ML-API-Key: dev-secret" \
  -d @sample-refine-request.json
```

## Docker

```bash
docker build -f ml/Dockerfile -t placement-ml .
docker run -p 8000:8000 \
  -e ML_API_KEY=dev-secret \
  -v "$(pwd)/ml/checkpoints:/app/ml/checkpoints" \
  placement-ml
```

## Deploy (Railway / Fly / Modal)

1. Build and push the Docker image.
2. Mount or download checkpoint to `ML_CHECKPOINT_PATH`.
3. Set `ML_API_KEY` and `ML_MODEL_VERSION`.
4. Point Next.js `ML_INFERENCE_URL` at the service URL.

### Railway

- Create a service from `ml/Dockerfile`.
- Add volume or release-phase download for `best.pt`.
- Set env: `ML_API_KEY`, `ML_CHECKPOINT_PATH=/app/ml/checkpoints/best.pt`.

### Modal (training)

Run `placement_ml.train` on a GPU worker on a schedule; upload `best.pt` to object storage; call `POST /admin/reload` after deploy.

## Feature contract

TypeScript: `src/lib/domain/training/ml-features.ts`  
Python: `placement_ml/features.py`

Keep both files in sync when changing tensor layouts.

## Promotion gates

Before enabling `PLACEMENT_ML_ENABLED` in production:

- `model_beats_baseline_mae` on test split
- Median position MAE improvement vs heuristic
- No large regression in head-count error

See `placement_ml/evaluate.py` output and `src/lib/domain/training/ml-promotion.ts`.

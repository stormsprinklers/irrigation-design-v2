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

Railway must build the **Python Docker image**, not the Next.js app. If you see `npm ci` / `package-lock.json` errors, Railway is treating this repo as Node — switch the builder to Dockerfile (see below).

**1. Create a new Railway project** (separate from Vercel):

- New Project → Deploy from GitHub → select this repo
- This service is **only** for `ml/serve` (inference API), not the Next.js app

**2. Use Docker build** (repo includes [`railway.toml`](../railway.toml)):

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "ml/Dockerfile"
```

If deploy still runs `npm ci`, open **Settings → Build → Builder** and set **Dockerfile** with path `ml/Dockerfile`. Disable Nixpacks auto-detect for Node.

**3. Service variables** (Railway → Variables):

| Variable | Example |
|----------|---------|
| `ML_API_KEY` | long random secret (same value on Vercel) |
| `ML_MODEL_VERSION` | `v1` |
| `ML_CHECKPOINT_PATH` | `/app/ml/checkpoints/best.pt` |
| `PORT` | Railway sets this automatically |

**4. Model checkpoint** — pick one:

- **Volume (recommended):** Settings → Volumes → mount at `/app/ml/checkpoints`, upload `best.pt` after first deploy
- **Build-time:** copy `best.pt` into the image (not ideal for large files in git)

Without `best.pt`, `/health` returns `modelLoaded: false` and `/v1/refine` returns 503 until a checkpoint exists.

**5. Public URL:** Settings → Networking → Generate Domain. Use that URL as `ML_INFERENCE_URL` on Vercel.

**6. Vercel env** (your main app):

```
ML_INFERENCE_URL=https://your-service.up.railway.app
ML_API_KEY=<same as Railway>
ML_MODEL_VERSION=v1
PLACEMENT_ML_ENABLED=true
```

**Verify:**

```bash
curl https://your-service.up.railway.app/health
```

Expect `{"status":"ok","modelLoaded":true,...}` once checkpoint is mounted.

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

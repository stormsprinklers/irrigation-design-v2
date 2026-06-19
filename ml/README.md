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

# GitHub Actions secrets (for automated retrain deploy)
# DATABASE_URL — same as production DB
# ML_INFERENCE_URL — Railway ML service URL
# ML_API_KEY — shared with Railway ML service
# ML_MODEL_VERSION — optional prefix; CI registers as v1-<run-number>

## Model versions

| Version | Behavior |
|---------|----------|
| **v1** (legacy) | Move/delete algorithm heads only — cannot add new heads |
| **v2** (default) | Places heads with predicted **position**, **throw distance (radius)**, **arc**, **rotation**, **nozzle** (`catalogItemId`), and **spray/rotor body** (`headBodyId`). Values are clamped to each nozzle's adjustability range and GPM is recalculated after inference. |

Training defaults to `--model v2`. Checkpoints include `"model_type": "v2"`. The inference service loads v1 or v2 automatically.

After deploying v2 training code, **re-run ML Retrain** so Railway serves a v2 checkpoint. Old v1 checkpoints will still load but only edit algorithm heads.

## Automated retrain loop

1. Approve training examples in the app (data saved to Postgres).
2. GitHub Actions [`.github/workflows/ml-retrain.yml`](../.github/workflows/ml-retrain.yml) runs weekly, on manual dispatch, or when Vercel triggers `repository_dispatch` every 25 approvals.
3. CI exports JSONL, trains, evaluates, checks promotion gates.
4. If gates pass, CI uploads `best.pt` to Railway via `POST /admin/upload-checkpoint` (persists on volume).
5. Model registry row created in `PlacementModelVersion`.

### GitHub repository secrets

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | Export training examples |
| `ML_INFERENCE_URL` | Railway service base URL |
| `ML_API_KEY` | Auth for upload endpoint |

### Vercel env (optional auto-trigger)

```
ML_RETRAIN_ON_APPROVE=true
ML_RETRAIN_BATCH_SIZE=25
GITHUB_RETRAIN_TOKEN=<PAT with repo dispatch>
GITHUB_REPOSITORY=your-org/Irrigation-Design-v2
```

### Manual deploy after local train

```bash
ML_INFERENCE_URL=https://... ML_API_KEY=... node scripts/ml-deploy-checkpoint.mjs ml/checkpoints/best.pt
```

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

Sanity checks only (deploy is blocked only if the export is empty or mean head-count delta exceeds 30):

- At least one example in the eval export
- Head-count delta mean ≤ 30 (prevents runaway inference)

MAE vs baseline is logged as **informational** — it does not block deploy. Eval runs on **all** exported examples (`--split all`), not just the 15% test bucket.

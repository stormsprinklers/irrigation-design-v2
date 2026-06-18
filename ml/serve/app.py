"""FastAPI inference service for placement refinement."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import torch
from fastapi import Depends, FastAPI, Header, HTTPException

from placement_ml.features import build_ml_feature_tensors, tensors_to_model_arrays
from placement_ml.labels import apply_predicted_deltas
from placement_ml.model_v1 import PlacementCorrectionModelV1

from .schemas import (
    HealthResponseSchema,
    RefineRequestSchema,
    RefineResponseSchema,
    ReloadResponseSchema,
    TrainingHeadSnapshotSchema,
)


class ModelStore:
    def __init__(self):
        self.model: PlacementCorrectionModelV1 | None = None
        self.catalog_vocab: dict[str, int] = {}
        self.poly_dim: int | None = None
        self.checkpoint_path: str | None = None
        self.model_version: str | None = None
        self.device: str = "cpu"

    def load(self, checkpoint_path: str, model_version: str | None = None):
        ckpt = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
        self.poly_dim = ckpt["poly_dim"]
        self.catalog_vocab = ckpt.get("catalog_vocab", {})
        model = PlacementCorrectionModelV1(poly_dim=self.poly_dim)
        model.load_state_dict(ckpt["model_state_dict"])
        model.eval()
        self.model = model
        self.checkpoint_path = checkpoint_path
        self.model_version = model_version or os.environ.get("ML_MODEL_VERSION", "v1")

    def predict(self, req: RefineRequestSchema) -> RefineResponseSchema:
        if self.model is None:
            raise HTTPException(status_code=503, detail="Model not loaded")

        baseline = [h.model_dump() for h in req.baselineHeads]
        ctx = req.placementContext.model_dump()
        shape = req.shapeClass or "rectangle"
        vertices = [v.model_dump() for v in req.polygonVerticesFt]

        tensors = build_ml_feature_tensors(
            vertices,
            shape,
            baseline,
            ctx,
            self.catalog_vocab or None,
        )
        arrays = tensors_to_model_arrays(tensors)
        poly = torch.tensor(arrays["poly"]).unsqueeze(0)
        heads = torch.tensor(arrays["heads"]).unsqueeze(0)
        context = torch.tensor(arrays["context"]).unsqueeze(0)
        mask = torch.tensor(arrays["head_mask"]).unsqueeze(0)

        with torch.no_grad():
            delta, delete_logit = self.model(poly, heads, context, mask)
        delete_prob = torch.sigmoid(delete_logit).cpu().numpy()[0]
        delta_np = delta.cpu().numpy()[0]

        opts = req.options
        delete_threshold = 1.0 - (opts.minConfidence if opts else 0.6)
        max_delta = opts.maxDeltaFt if opts else 15.0

        refined, diagnostics = apply_predicted_deltas(
            baseline,
            delta_np,
            delete_prob,
            tensors.bbox,
            delete_threshold=delete_threshold,
            max_delta_ft=max_delta,
        )

        refined_heads = [TrainingHeadSnapshotSchema.model_validate(h) for h in refined]
        return RefineResponseSchema(
            refinedHeads=refined_heads,
            diagnostics={
                "deletedIds": diagnostics["deletedIds"],
                "addedHeads": [],
                "meanConfidence": diagnostics["meanConfidence"],
                "appliedDeltas": diagnostics["appliedDeltas"],
            },
        )


store = ModelStore()


def verify_api_key(x_ml_api_key: str | None = Header(default=None)):
    expected = os.environ.get("ML_API_KEY")
    if expected and x_ml_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ckpt = os.environ.get("ML_CHECKPOINT_PATH", "ml/checkpoints/best.pt")
    if Path(ckpt).exists():
        store.load(ckpt)
        print(f"Loaded model from {ckpt}")
    else:
        print(f"No checkpoint at {ckpt} — /v1/refine will return 503 until loaded")
    yield


app = FastAPI(title="Placement ML Inference", version="0.1.0", lifespan=lifespan)


@app.get("/health", response_model=HealthResponseSchema)
def health():
    return HealthResponseSchema(
        modelLoaded=store.model is not None,
        modelVersion=store.model_version,
    )


@app.post("/v1/refine", response_model=RefineResponseSchema, dependencies=[Depends(verify_api_key)])
def refine(req: RefineRequestSchema):
    return store.predict(req)


@app.post("/admin/reload", response_model=ReloadResponseSchema, dependencies=[Depends(verify_api_key)])
def reload(checkpoint_path: str | None = None):
    path = checkpoint_path or os.environ.get("ML_CHECKPOINT_PATH", "ml/checkpoints/best.pt")
    if not Path(path).exists():
        raise HTTPException(status_code=404, detail=f"Checkpoint not found: {path}")
    store.load(path)
    return ReloadResponseSchema(ok=True, modelVersion=store.model_version, message=f"Loaded {path}")

"""FastAPI inference service for placement refinement."""
from __future__ import annotations

import os
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path

import torch
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile

from placement_ml.features import build_ml_feature_tensors, tensors_to_model_arrays
from placement_ml.labels import apply_predicted_deltas
from placement_ml.model_v1 import PlacementCorrectionModelV1
from placement_ml.model_v2 import PlacementModelV2
from placement_ml.placement_labels import decode_placed_heads

from .schemas import (
    HealthResponseSchema,
    RefineRequestSchema,
    RefineResponseSchema,
    ReloadResponseSchema,
    TrainingHeadSnapshotSchema,
)


def default_checkpoint_path() -> str:
    return os.environ.get("ML_CHECKPOINT_PATH", "checkpoints/best.pt")


def download_checkpoint(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as response:
        dest.write_bytes(response.read())


def ensure_checkpoint(path: str | None = None) -> str:
    ckpt = path or default_checkpoint_path()
    ckpt_path = Path(ckpt)
    if ckpt_path.exists():
        return str(ckpt_path)

    download_url = os.environ.get("CHECKPOINT_DOWNLOAD_URL")
    if download_url:
        print(f"Downloading checkpoint from CHECKPOINT_DOWNLOAD_URL to {ckpt_path}")
        download_checkpoint(download_url, ckpt_path)
        return str(ckpt_path)

    raise FileNotFoundError(f"Checkpoint not found: {ckpt}")


class ModelStore:
    def __init__(self):
        self.model: PlacementCorrectionModelV1 | PlacementModelV2 | None = None
        self.model_type: str = "v1"
        self.catalog_vocab: dict[str, int] = {}
        self.body_vocab: dict[str, int] = {}
        self.poly_dim: int | None = None
        self.checkpoint_path: str | None = None
        self.model_version: str | None = None
        self.device: str = "cpu"

    def load(self, checkpoint_path: str, model_version: str | None = None):
        ckpt = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
        self.poly_dim = ckpt["poly_dim"]
        self.catalog_vocab = ckpt.get("catalog_vocab", {})
        self.body_vocab = ckpt.get("body_vocab", {})
        self.model_type = ckpt.get("model_type", "v1")

        if self.model_type == "v2":
            model = PlacementModelV2(poly_dim=self.poly_dim)
        else:
            model = PlacementCorrectionModelV1(poly_dim=self.poly_dim)

        model.load_state_dict(ckpt["model_state_dict"])
        model.eval()
        self.model = model
        self.checkpoint_path = checkpoint_path
        self.model_version = model_version or os.environ.get("ML_MODEL_VERSION", "v1")

    def predict_v1(self, req: RefineRequestSchema) -> RefineResponseSchema:
        assert isinstance(self.model, PlacementCorrectionModelV1)
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
        delete_threshold = 0.55
        if opts and opts.minConfidence is not None:
            delete_threshold = 1.0 - opts.minConfidence
        max_delta = opts.maxDeltaFt if opts else 15.0

        refined, diagnostics = apply_predicted_deltas(
            baseline,
            delta_np,
            delete_prob,
            tensors.bbox,
            delete_threshold=delete_threshold,
            max_delta_ft=max_delta,
        )
        diagnostics["modelType"] = "v1"

        refined_heads = [TrainingHeadSnapshotSchema.model_validate(h) for h in refined]
        return RefineResponseSchema(
            refinedHeads=refined_heads,
            diagnostics={
                "deletedIds": diagnostics["deletedIds"],
                "addedHeads": [],
                "meanConfidence": diagnostics["meanConfidence"],
                "appliedDeltas": diagnostics["appliedDeltas"],
                "modelType": "v1",
            },
        )

    def predict_v2(self, req: RefineRequestSchema) -> RefineResponseSchema:
        assert isinstance(self.model, PlacementModelV2)
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
            exist_logit, pos, radius, arc, rotation, nozzle, body = self.model(
                poly, heads, context, mask
            )

        default_nozzle = None
        catalog_ids = ctx.get("catalogItemIds") or []
        if catalog_ids:
            default_nozzle = catalog_ids[0]

        placed, diagnostics = decode_placed_heads(
            exist_logit.cpu().numpy()[0],
            pos.cpu().numpy()[0],
            radius.cpu().numpy()[0],
            arc.cpu().numpy()[0],
            rotation.cpu().numpy()[0],
            nozzle.cpu().numpy()[0],
            body.cpu().numpy()[0],
            tensors.bbox,
            self.catalog_vocab,
            self.body_vocab,
            default_nozzle_id=default_nozzle,
        )

        refined_heads = [TrainingHeadSnapshotSchema.model_validate(h) for h in placed]
        return RefineResponseSchema(
            refinedHeads=refined_heads,
            diagnostics={
                "deletedIds": diagnostics["deletedIds"],
                "addedHeads": refined_heads,
                "meanConfidence": diagnostics["meanConfidence"],
                "appliedDeltas": diagnostics["appliedDeltas"],
                "modelType": "v2",
                "predictedHeadCount": diagnostics["predictedHeadCount"],
            },
        )

    def predict(self, req: RefineRequestSchema) -> RefineResponseSchema:
        if self.model is None:
            raise HTTPException(status_code=503, detail="Model not loaded")

        if self.model_type == "v2":
            return self.predict_v2(req)
        return self.predict_v1(req)


store = ModelStore()


def verify_api_key(x_ml_api_key: str | None = Header(default=None)):
    expected = os.environ.get("ML_API_KEY")
    if expected and x_ml_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        path = ensure_checkpoint()
        store.load(path)
        print(f"Loaded model from {path}")
    except FileNotFoundError as err:
        print(f"{err} — /v1/refine will return 503 until loaded")
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
def reload(checkpoint_path: str | None = None, checkpoint_url: str | None = None):
    try:
        if checkpoint_url:
            dest = Path(checkpoint_path or default_checkpoint_path())
            download_checkpoint(checkpoint_url, dest)
            path = str(dest)
        else:
            path = ensure_checkpoint(checkpoint_path)
        store.load(path)
    except FileNotFoundError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    return ReloadResponseSchema(ok=True, modelVersion=store.model_version, message=f"Loaded {path}")


@app.post("/admin/upload-checkpoint", response_model=ReloadResponseSchema, dependencies=[Depends(verify_api_key)])
async def upload_checkpoint(file: UploadFile = File(...)):
    dest = Path(default_checkpoint_path())
    dest.parent.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    dest.write_bytes(content)
    store.load(str(dest))
    return ReloadResponseSchema(
        ok=True,
        modelVersion=store.model_version,
        message=f"Uploaded and loaded {dest} ({len(content)} bytes)",
    )

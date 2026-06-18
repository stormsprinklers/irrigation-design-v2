"""Pydantic schemas for inference API — mirrors ml-features.ts payloads."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PointSchema(BaseModel):
    x: float
    y: float


class TrainingHeadSnapshotSchema(BaseModel):
    id: str
    positionFt: PointSchema
    radiusFeet: float
    arcDegrees: float
    rotationDegrees: float
    wedgeStartDeg: float = 0
    wedgeEndDeg: float = 360
    catalogItemId: str
    headBodyId: str | None = None
    nozzleModel: str | None = None
    gpm: float | None = None
    precipInPerHr: float | None = None


class PlacementContextSchema(BaseModel):
    headPreference: str = "ROTOR"
    pressurePsi: float = 65
    pattern: str | None = None
    nozzleModel: str | None = None
    catalogItemIds: list[str] = Field(default_factory=list)


class RefineOptionsSchema(BaseModel):
    maxDeltaFt: float = 15
    minConfidence: float = 0.6


class RefineRequestSchema(BaseModel):
    modelVersion: str | None = None
    polygonVerticesFt: list[PointSchema]
    shapeClass: str | None = None
    placementContext: PlacementContextSchema
    baselineHeads: list[TrainingHeadSnapshotSchema]
    options: RefineOptionsSchema | None = None


class AppliedDeltaSchema(BaseModel):
    id: str
    dxFt: float
    dyFt: float
    deleteProb: float


class RefineDiagnosticsSchema(BaseModel):
    deletedIds: list[str]
    addedHeads: list[TrainingHeadSnapshotSchema] = Field(default_factory=list)
    meanConfidence: float
    appliedDeltas: list[AppliedDeltaSchema]


class RefineResponseSchema(BaseModel):
    refinedHeads: list[TrainingHeadSnapshotSchema]
    diagnostics: RefineDiagnosticsSchema


class ReloadResponseSchema(BaseModel):
    ok: bool
    modelVersion: str | None = None
    message: str = ""


class HealthResponseSchema(BaseModel):
    status: str = "ok"
    modelLoaded: bool
    modelVersion: str | None = None

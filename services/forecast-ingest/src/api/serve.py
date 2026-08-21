"""
FastAPI server for the resili flood risk ML model.

Exposes a REST API that accepts ward feature vectors and returns
explainable risk predictions. This service sits behind the Go API
gateway in production, but can be run standalone for development.

Run:
    uvicorn src.api.serve:app --host 0.0.0.0 --port 8001 --reload
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.features.ward_features import (
    DEMO_WARD_PROFILES,
    build_feature_vector,
    compute_exposure_score,
    compute_vulnerability_score,
)
from src.ingest.open_meteo import (
    LAKE_VICTORIA_STATIONS,
    build_deterministic_forecast,
    scenario_for_ward,
)
from src.model.flood_risk_model import MODEL_VERSION, FloodRiskModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Load or train model at startup
_model = FloodRiskModel()
_model_dir = Path(__file__).parent.parent.parent / "trained_model"


def _load_model() -> None:
    """Load a pre-trained model, or train and persist one on first run."""
    if (_model_dir / "flood_risk_model.json").exists():
        _model.load(_model_dir)
        logger.info("Loaded pre-trained model from %s", _model_dir)
    else:
        logger.info("No pre-trained model found. Training now...")
        from src.model.train import train_and_save

        trained = train_and_save(_model_dir)
        _model.model = trained.model
        _model.metrics = trained.metrics
        _model.is_trained = True
        logger.info("Model trained and loaded at startup")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Ensure a trained model is available before the service accepts traffic."""
    _load_model()
    yield


app = FastAPI(
    title="resili Flood Risk ML API",
    description=(
        "Impact-based flood risk scoring for the Lake Victoria Basin. "
        "Scores are decision-support estimates, not certainties. "
        "Follow directives from KMD, NDMA, and county authorities."
    ),
    version=MODEL_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# --- Request/Response schemas ---


class PredictRequest(BaseModel):
    """Ward risk prediction request."""

    ward_id: str = Field(..., description="Ward identifier, e.g. KE-039-NYANDO")
    use_live_data: bool = Field(
        default=False,
        description="If true, attempt to fetch live forecast data (requires network). "
        "If false, use deterministic demo fixtures.",
    )


class FeatureContributions(BaseModel):
    """Breakdown of how each feature contributed to the score."""

    precip_3day_sum: float = 0.0
    precip_5day_sum: float = 0.0
    precip_max_daily: float = 0.0
    discharge_ratio: float = 0.0
    discharge_trend: float = 0.0
    rainfall_anomaly: float = 0.0
    antecedent_moisture: float = 0.0
    exposure_score: float = 0.0
    vulnerability_score: float = 0.0
    flood_plain_fraction: float = 0.0
    historical_flood_frequency: float = 0.0


class PredictResponse(BaseModel):
    """Ward risk prediction with explanation."""

    ward_id: str
    score: float = Field(..., ge=0, le=100, description="Risk score 0-100")
    band: str = Field(..., description="Risk band: low, moderate, high, severe")
    probability: float = Field(..., ge=0, le=1)
    feature_contributions: FeatureContributions
    model_version: str
    explanation: list[str]
    assessed_at: str
    inputs_hash: str
    source: str
    situation: str


class HealthResponse(BaseModel):
    """Service health status."""

    status: str
    model_loaded: bool
    model_version: str
    wards_available: list[str]


class AllWardsResponse(BaseModel):
    """Risk assessment for all configured wards."""

    assessed_at: str
    model_version: str
    wards: list[PredictResponse]
    source: str


# --- Endpoints ---


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Check service health and model readiness."""
    return HealthResponse(
        status="healthy" if _model.is_trained else "model_not_loaded",
        model_loaded=_model.is_trained,
        model_version=MODEL_VERSION,
        wards_available=list(DEMO_WARD_PROFILES.keys()),
    )


@app.post("/predict", response_model=PredictResponse)
def predict_ward_risk(request: PredictRequest) -> PredictResponse:
    """
    Predict flood risk for a single ward.

    Returns an explainable risk score with feature contributions
    showing exactly what drove the assessment.
    """
    if not _model.is_trained:
        raise HTTPException(status_code=503, detail="Model not yet loaded.")

    profile = DEMO_WARD_PROFILES.get(request.ward_id)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=f"Ward {request.ward_id} not found. Available: {list(DEMO_WARD_PROFILES.keys())}",
        )

    # Find the matching station for this ward
    station = next((s for s in LAKE_VICTORIA_STATIONS if s.ward_id == request.ward_id), None)
    if station is None:
        raise HTTPException(status_code=404, detail=f"No station configured for ward {request.ward_id}")

    # Build forecast data from the deterministic demo scenario for this ward.
    scenario = scenario_for_ward(request.ward_id)
    weather_df, discharge_df = build_deterministic_forecast(
        station,
        precipitation_mm=scenario.precipitation_mm,
        discharge_m3s=scenario.discharge_m3s,
        discharge_mean_m3s=scenario.discharge_mean_m3s,
    )

    # Build historical context
    from src.ingest.chirps import build_historical_chirps

    historical_df = build_historical_chirps(
        ward_id=request.ward_id,
        latitude=station.latitude,
        longitude=station.longitude,
    )

    # Compute features
    features = build_feature_vector(weather_df, discharge_df, historical_df, profile)

    # Run prediction
    prediction = _model.predict(features, request.ward_id)

    now_utc = datetime.now(UTC).isoformat()
    inputs_hash = hashlib.sha256(json.dumps(features, sort_keys=True).encode()).hexdigest()[:16]

    return PredictResponse(
        ward_id=prediction.ward_id,
        score=prediction.score,
        band=prediction.band,
        probability=prediction.probability,
        feature_contributions=FeatureContributions(**prediction.feature_contributions),
        model_version=prediction.model_version,
        explanation=prediction.explanation,
        assessed_at=now_utc,
        inputs_hash=inputs_hash,
        source="deterministic-demo-fixture",
        situation=scenario.narrative,
    )


@app.get("/predict/all", response_model=AllWardsResponse)
def predict_all_wards() -> AllWardsResponse:
    """
    Predict flood risk for all configured wards.

    This is the primary endpoint used by the Console portal
    to populate the risk map.
    """
    if not _model.is_trained:
        raise HTTPException(status_code=503, detail="Model not yet loaded.")

    now_utc = datetime.now(UTC).isoformat()
    results = []

    for ward_id in DEMO_WARD_PROFILES:
        req = PredictRequest(ward_id=ward_id)
        result = predict_ward_risk(req)
        results.append(result)

    return AllWardsResponse(
        assessed_at=now_utc,
        model_version=MODEL_VERSION,
        wards=results,
        source="deterministic-demo-fixture",
    )


@app.get("/wards")
def list_wards() -> dict:
    """List all configured wards with their static profiles."""
    wards = []
    for ward_id, profile in DEMO_WARD_PROFILES.items():
        station = next((s for s in LAKE_VICTORIA_STATIONS if s.ward_id == ward_id), None)
        wards.append(
            {
                "ward_id": ward_id,
                "exposure_score": compute_exposure_score(profile),
                "vulnerability_score": compute_vulnerability_score(profile),
                "latitude": station.latitude if station else None,
                "longitude": station.longitude if station else None,
                "flood_plain_fraction": profile.flood_plain_fraction,
                "historical_flood_frequency": profile.historical_flood_frequency,
            }
        )
    return {"wards": wards, "count": len(wards)}

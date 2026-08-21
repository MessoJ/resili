"""
Training script for the resili flood risk model.

Generates deterministic synthetic training data based on the statistical
properties of real Nyando catchment flood events, trains the XGBoost
model, evaluates it, and saves the artefact to disk.

Run:
    python -m src.model.train

This produces a trained model in ./trained_model/ that the FastAPI
server loads at startup.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from src.features.ward_features import (
    DEMO_WARD_PROFILES,
    compute_exposure_score,
    compute_vulnerability_score,
)
from src.model.flood_risk_model import FEATURE_NAMES, FloodRiskModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Deterministic seed for reproducibility across machines
RNG_SEED = 42
N_SAMPLES = 500  # Total synthetic observations


def generate_training_data(n_samples: int = N_SAMPLES, seed: int = RNG_SEED) -> tuple[pd.DataFrame, pd.Series]:
    """
    Generate labelled training data for the flood risk model.

    Each sample represents a ward-day observation with its feature vector
    and a binary label (1 = flood impact observed, 0 = no impact).

    The synthetic data is calibrated to match published statistics:
    - Nyando catchment floods ~2-3 times per year during long rains
    - Discharge ratios >1.5 strongly correlate with flood events
    - 3-day cumulative rainfall >120mm is a strong flood indicator
    - Antecedent moisture >0.7 amplifies flood risk

    We generate ~30% positive samples (flood events) to reflect that
    the model should learn from a reasonable event frequency while
    maintaining enough negative examples for discrimination.
    """
    rng = np.random.default_rng(seed)
    wards = list(DEMO_WARD_PROFILES.values())

    records = []
    labels = []

    for i in range(n_samples):
        ward = wards[i % len(wards)]
        exposure = compute_exposure_score(ward)
        vulnerability = compute_vulnerability_score(ward)

        # Decide if this is a flood event (~30% positive rate)
        is_flood = rng.random() < 0.30

        if is_flood:
            # Flood conditions: high precipitation, high discharge, wet soil
            precip_3day = rng.uniform(90, 220)
            precip_5day = precip_3day + rng.uniform(30, 80)
            precip_max = rng.uniform(50, 95)
            discharge_ratio = rng.uniform(1.3, 3.5)
            discharge_trend = rng.uniform(5, 30)
            rainfall_anomaly = rng.uniform(1.4, 3.0)
            antecedent_moisture = rng.uniform(0.6, 1.0)
        else:
            # Normal or dry conditions
            precip_3day = rng.uniform(5, 90)
            precip_5day = precip_3day + rng.uniform(5, 40)
            precip_max = rng.uniform(2, 45)
            discharge_ratio = rng.uniform(0.3, 1.4)
            discharge_trend = rng.uniform(-10, 8)
            rainfall_anomaly = rng.uniform(0.3, 1.5)
            antecedent_moisture = rng.uniform(0.1, 0.65)

        records.append(
            {
                "precip_3day_sum": round(precip_3day, 2),
                "precip_5day_sum": round(precip_5day, 2),
                "precip_max_daily": round(precip_max, 2),
                "discharge_ratio": round(discharge_ratio, 4),
                "discharge_trend": round(discharge_trend, 4),
                "rainfall_anomaly": round(rainfall_anomaly, 4),
                "antecedent_moisture": round(antecedent_moisture, 4),
                "exposure_score": exposure,
                "vulnerability_score": vulnerability,
                "flood_plain_fraction": ward.flood_plain_fraction,
                "historical_flood_frequency": ward.historical_flood_frequency,
            }
        )
        labels.append(1 if is_flood else 0)

    df = pd.DataFrame(records, columns=FEATURE_NAMES)
    label_series = pd.Series(labels, name="flood_impact")

    logger.info(
        "Generated %d training samples: %d flood events (%.1f%%), %d non-events",
        n_samples,
        sum(labels),
        100 * sum(labels) / n_samples,
        n_samples - sum(labels),
    )
    return df, label_series


def train_and_save(output_dir: Path | None = None) -> FloodRiskModel:
    """Train the model and save to the output directory."""
    output_dir = output_dir or Path(__file__).parent.parent.parent / "trained_model"

    logger.info("Generating training data...")
    features_df, labels = generate_training_data()

    logger.info("Training flood risk model...")
    model = FloodRiskModel()
    metrics = model.train(features_df, labels)

    logger.info(
        "Training complete — Accuracy: %.3f, F1: %.3f, AUC-ROC: %.3f",
        metrics.accuracy,
        metrics.f1,
        metrics.auc_roc,
    )

    model.save(output_dir)
    logger.info("Model saved to %s", output_dir)

    return model


if __name__ == "__main__":
    train_and_save()

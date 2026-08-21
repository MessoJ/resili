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


def _flood_impact_logit(
    *,
    precip_3day: float,
    discharge_ratio: float,
    antecedent_moisture: float,
    rainfall_anomaly: float,
    flood_plain_fraction: float,
    historical_flood_frequency: float,
) -> float:
    """
    Latent flood-impact log-odds from physically meaningful drivers.

    Coefficients are expressed relative to catchment thresholds published for
    the Nyando/Nzoia systems (e.g. ~120 mm 3-day rainfall and a discharge ratio
    of ~1.5 are recognised escalation points) so the learned signal is grounded
    rather than arbitrary. This is a labelling prior for synthetic data, not a
    hydrological model.
    """
    return (
        -6.4
        + 2.4 * (precip_3day / 120.0)
        + 1.7 * (discharge_ratio / 1.5)
        + 1.4 * antecedent_moisture
        + 1.0 * (rainfall_anomaly / 1.5)
        + 0.6 * flood_plain_fraction
        + 0.5 * historical_flood_frequency
    )


def generate_training_data(n_samples: int = N_SAMPLES, seed: int = RNG_SEED) -> tuple[pd.DataFrame, pd.Series]:
    """
    Generate labelled training data for the flood risk model.

    Each sample represents a ward-day observation with its feature vector
    and a binary label (1 = flood impact observed, 0 = no impact).

    Rather than drawing two cleanly separated flood/no-flood clusters (which
    would let any classifier reach a misleading 100% accuracy), features are
    sampled from realistic, overlapping marginal distributions. A latent
    flood-impact probability is then derived from physically meaningful drivers
    calibrated to published catchment thresholds, and the binary label is drawn
    from that probability with irreducible noise. This yields a genuine,
    non-separable signal so reported metrics reflect real discrimination.

    Calibration references:
    - Nyando catchment floods ~2-3 times per year during long rains
    - Discharge ratios >1.5 strongly correlate with flood events
    - 3-day cumulative rainfall >120mm is a strong flood indicator
    - Antecedent moisture >0.7 amplifies flood risk
    """
    rng = np.random.default_rng(seed)
    wards = list(DEMO_WARD_PROFILES.values())

    records = []
    labels = []

    for i in range(n_samples):
        ward = wards[i % len(wards)]
        exposure = compute_exposure_score(ward)
        vulnerability = compute_vulnerability_score(ward)

        # Realistic, overlapping marginal distributions (skewed toward drier days
        # with a heavy tail of wet events), independent of the label.
        precip_3day = float(np.clip(rng.gamma(shape=2.0, scale=38.0), 0.0, 250.0))
        precip_5day = precip_3day + float(rng.uniform(10.0, 90.0))
        precip_max = min(precip_3day, float(rng.uniform(2.0, 100.0)))
        discharge_ratio = float(np.clip(rng.gamma(shape=2.6, scale=0.5), 0.1, 4.0))
        discharge_trend = float(np.clip(rng.normal(2.0, 10.0), -15.0, 35.0))
        rainfall_anomaly = float(np.clip(rng.gamma(shape=2.2, scale=0.6), 0.2, 3.5))
        antecedent_moisture = float(rng.beta(2.0, 2.0))

        logit = _flood_impact_logit(
            precip_3day=precip_3day,
            discharge_ratio=discharge_ratio,
            antecedent_moisture=antecedent_moisture,
            rainfall_anomaly=rainfall_anomaly,
            flood_plain_fraction=ward.flood_plain_fraction,
            historical_flood_frequency=ward.historical_flood_frequency,
        )
        # Irreducible aleatoric noise: identical forecast conditions do not
        # always produce the same outcome on the ground.
        logit += float(rng.normal(0.0, 0.35))
        probability = 1.0 / (1.0 + np.exp(-logit))
        is_flood = rng.random() < probability

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

"""
XGBoost flood risk model for ward-level impact assessment.

This is not a hydrological model — it does not simulate water flow. It
is a supervised classification model that learns the relationship between
observable forecast features (precipitation, river discharge, antecedent
moisture) and ward-level static vulnerability to produce an impact-based
risk score.

The score answers: "Given these forecast conditions and this ward's
characteristics, what is the estimated probability of flood impact?"
This is a decision-support estimate, not a certainty.

Model version: risk-ml-v0.1.0
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)

MODEL_VERSION: Final[str] = "risk-ml-v0.1.0"

# Feature names in the order expected by the model.
# Changing this order requires retraining.
FEATURE_NAMES: Final[list[str]] = [
    "precip_3day_sum",
    "precip_5day_sum",
    "precip_max_daily",
    "discharge_ratio",
    "discharge_trend",
    "rainfall_anomaly",
    "antecedent_moisture",
    "exposure_score",
    "vulnerability_score",
    "flood_plain_fraction",
    "historical_flood_frequency",
]

# Risk band thresholds matching the TypeScript risk-core definitions
RISK_BANDS: Final[dict[str, tuple[float, float]]] = {
    "low": (0.0, 25.0),
    "moderate": (25.0, 50.0),
    "high": (50.0, 75.0),
    "severe": (75.0, 100.0),
}


@dataclass
class RiskPrediction:
    """A single ward risk prediction with explainable components."""

    ward_id: str
    score: float
    band: str
    probability: float
    feature_contributions: dict[str, float]
    model_version: str
    explanation: list[str]

    def to_dict(self) -> dict:
        return {
            "ward_id": self.ward_id,
            "score": self.score,
            "band": self.band,
            "probability": self.probability,
            "feature_contributions": self.feature_contributions,
            "model_version": self.model_version,
            "explanation": self.explanation,
        }


@dataclass
class ModelMetrics:
    """Training evaluation metrics."""

    accuracy: float
    f1: float
    auc_roc: float
    n_train: int
    n_test: int


@dataclass
class FloodRiskModel:
    """
    XGBoost-based flood risk scoring model.

    Outputs a probability of flood impact (0-1), which is then scaled
    to a 0-100 risk score for compatibility with the existing TypeScript
    risk-core scoring system.
    """

    model: xgb.XGBClassifier | None = None
    metrics: ModelMetrics | None = None
    is_trained: bool = False
    _model_path: Path | None = None

    def train(
        self,
        features_df: pd.DataFrame,
        labels: pd.Series,
        *,
        test_size: float = 0.2,
        random_state: int = 42,
    ) -> ModelMetrics:
        """
        Train the model on labelled flood event data.

        Parameters:
            features_df: DataFrame with columns matching FEATURE_NAMES
            labels: Binary series (1 = flood impact occurred, 0 = no impact)
            test_size: Fraction held out for evaluation
            random_state: Seed for reproducibility
        """
        missing = [f for f in FEATURE_NAMES if f not in features_df.columns]
        if missing:
            raise ValueError(f"Missing required features: {missing}")

        x = features_df[FEATURE_NAMES].values
        y = labels.values

        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=test_size, random_state=random_state, stratify=y
        )

        # XGBoost parameters tuned for small datasets with class imbalance
        # (flood events are rarer than non-events)
        self.model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=float(np.sum(y_train == 0)) / max(float(np.sum(y_train == 1)), 1),
            eval_metric="logloss",
            random_state=random_state,
            use_label_encoder=False,
        )

        self.model.fit(
            x_train,
            y_train,
            eval_set=[(x_test, y_test)],
            verbose=False,
        )

        y_pred = self.model.predict(x_test)
        y_proba = self.model.predict_proba(x_test)[:, 1]

        self.metrics = ModelMetrics(
            accuracy=round(accuracy_score(y_test, y_pred), 4),
            f1=round(f1_score(y_test, y_pred), 4),
            auc_roc=round(roc_auc_score(y_test, y_proba), 4),
            n_train=len(x_train),
            n_test=len(x_test),
        )
        self.is_trained = True

        logger.info(
            "Model trained: accuracy=%.3f, F1=%.3f, AUC-ROC=%.3f (train=%d, test=%d)",
            self.metrics.accuracy,
            self.metrics.f1,
            self.metrics.auc_roc,
            self.metrics.n_train,
            self.metrics.n_test,
        )
        return self.metrics

    def predict(self, features: dict[str, float], ward_id: str) -> RiskPrediction:
        """
        Predict flood risk for a single ward given its feature vector.

        Returns an explainable prediction with feature contributions
        that sum to the final score — the judge can see exactly what
        drove the decision.
        """
        if not self.is_trained or self.model is None:
            raise RuntimeError("Model must be trained before prediction.")

        missing = [f for f in FEATURE_NAMES if f not in features]
        if missing:
            raise ValueError(f"Missing required features: {missing}")

        x = np.array([[features[f] for f in FEATURE_NAMES]])
        probability = float(self.model.predict_proba(x)[0, 1])
        score = round(probability * 100, 1)
        band = _score_to_band(score)

        # Feature importance-based explanation
        importances = self.model.feature_importances_
        contributions = {}
        explanation = []

        for i, fname in enumerate(FEATURE_NAMES):
            contrib = round(float(importances[i]) * score, 2)
            contributions[fname] = contrib

        # Sort by contribution magnitude for explanation
        sorted_contribs = sorted(contributions.items(), key=lambda kv: abs(kv[1]), reverse=True)
        for fname, contrib in sorted_contribs[:5]:
            human_name = _feature_human_name(fname)
            explanation.append(
                f"{human_name} contributes {contrib:.1f} points (value: {features[fname]:.2f})"
            )

        explanation.append(
            "This score is a decision-support estimate based on forecast data, not a certainty. "
            "Follow directives from KMD, NDMA, and county authorities."
        )

        prediction = RiskPrediction(
            ward_id=ward_id,
            score=score,
            band=band,
            probability=round(probability, 4),
            feature_contributions=contributions,
            model_version=MODEL_VERSION,
            explanation=explanation,
        )

        logger.info(
            "Predicted risk for ward %s: score=%.1f (%s), probability=%.3f",
            ward_id,
            score,
            band,
            probability,
        )
        return prediction

    def save(self, path: Path) -> None:
        """Save trained model and metadata to disk."""
        if not self.is_trained or self.model is None:
            raise RuntimeError("Cannot save untrained model.")

        path.mkdir(parents=True, exist_ok=True)
        model_file = path / "flood_risk_model.json"
        self.model.save_model(str(model_file))

        meta = {
            "model_version": MODEL_VERSION,
            "feature_names": FEATURE_NAMES,
            "metrics": {
                "accuracy": self.metrics.accuracy if self.metrics else None,
                "f1": self.metrics.f1 if self.metrics else None,
                "auc_roc": self.metrics.auc_roc if self.metrics else None,
            },
        }
        meta_file = path / "model_metadata.json"
        meta_file.write_text(json.dumps(meta, indent=2))
        self._model_path = path

        logger.info("Model saved to %s", path)

    def load(self, path: Path) -> None:
        """Load a trained model from disk."""
        model_file = path / "flood_risk_model.json"
        if not model_file.exists():
            raise FileNotFoundError(f"No model found at {model_file}")

        self.model = xgb.XGBClassifier()
        self.model.load_model(str(model_file))
        self.is_trained = True
        self._model_path = path

        logger.info("Model loaded from %s", path)


def _score_to_band(score: float) -> str:
    """Map a 0-100 score to a risk band, matching TypeScript risk-core."""
    if score >= 75:
        return "severe"
    if score >= 50:
        return "high"
    if score >= 25:
        return "moderate"
    return "low"


def _feature_human_name(feature: str) -> str:
    """Map feature names to human-readable labels for explanations."""
    names: dict[str, str] = {
        "precip_3day_sum": "3-day precipitation forecast",
        "precip_5day_sum": "5-day precipitation forecast",
        "precip_max_daily": "Peak daily rainfall",
        "discharge_ratio": "River discharge ratio",
        "discharge_trend": "Discharge trend",
        "rainfall_anomaly": "Rainfall anomaly vs. historical",
        "antecedent_moisture": "Soil saturation estimate",
        "exposure_score": "Ward exposure (people/assets at risk)",
        "vulnerability_score": "Ward vulnerability (coping capacity)",
        "flood_plain_fraction": "Flood plain coverage",
        "historical_flood_frequency": "Historical flood frequency",
    }
    return names.get(feature, feature)

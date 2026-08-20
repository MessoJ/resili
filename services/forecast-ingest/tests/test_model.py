"""
Tests for the flood risk ML pipeline.

Tests cover:
- Deterministic data generation produces consistent outputs
- Feature engineering computes valid ranges
- Model trains, predicts, and produces explainable output
- API endpoints return correct responses
- Edge cases and validation
"""

from __future__ import annotations

import pytest
import numpy as np
import pandas as pd
from pathlib import Path

from src.ingest.open_meteo import (
    StationCoordinate,
    build_deterministic_forecast,
    LAKE_VICTORIA_STATIONS,
)
from src.ingest.chirps import (
    build_historical_chirps,
    compute_rainfall_anomaly,
    ChirpsRainfallRecord,
)
from src.features.ward_features import (
    DEMO_WARD_PROFILES,
    WardStaticProfile,
    build_feature_vector,
    compute_exposure_score,
    compute_hazard_features,
    compute_vulnerability_score,
)
from src.model.flood_risk_model import FEATURE_NAMES, FloodRiskModel
from src.model.train import generate_training_data


# ── Ingest tests ────────────────────────────────────────────────────


class TestStationCoordinate:
    def test_valid_station(self) -> None:
        station = StationCoordinate("test", "KE-039-TEST", latitude=-0.17, longitude=34.92)
        assert station.station_id == "test"
        assert station.ward_id == "KE-039-TEST"

    def test_invalid_latitude_rejected(self) -> None:
        with pytest.raises(ValueError, match="Latitude"):
            StationCoordinate("bad", "KE-039-BAD", latitude=91.0, longitude=0.0)

    def test_invalid_longitude_rejected(self) -> None:
        with pytest.raises(ValueError, match="Longitude"):
            StationCoordinate("bad", "KE-039-BAD", latitude=0.0, longitude=181.0)


class TestDeterministicForecast:
    def test_produces_consistent_output(self) -> None:
        station = LAKE_VICTORIA_STATIONS[0]
        weather1, discharge1 = build_deterministic_forecast(station)
        weather2, discharge2 = build_deterministic_forecast(station)

        assert len(weather1) == 7
        assert len(discharge1) == 7
        pd.testing.assert_frame_equal(
            weather1.drop(columns=["fetched_at"]),
            weather2.drop(columns=["fetched_at"]),
        )

    def test_contains_required_columns(self) -> None:
        station = LAKE_VICTORIA_STATIONS[0]
        weather, discharge = build_deterministic_forecast(station)

        assert "precipitation_sum" in weather.columns
        assert "temperature_2m_max" in weather.columns
        assert "river_discharge" in discharge.columns
        assert "river_discharge_mean" in discharge.columns
        assert "source" in weather.columns

    def test_marks_source_as_fixture(self) -> None:
        station = LAKE_VICTORIA_STATIONS[0]
        weather, _ = build_deterministic_forecast(station)
        assert all(s == "deterministic-demo-fixture" for s in weather["source"])

    def test_lake_victoria_stations_exist(self) -> None:
        assert len(LAKE_VICTORIA_STATIONS) >= 5
        ward_ids = {s.ward_id for s in LAKE_VICTORIA_STATIONS}
        assert "KE-039-NYANDO" in ward_ids
        assert "KE-039-BUDALANGI" in ward_ids


class TestChirps:
    def test_historical_data_is_deterministic(self) -> None:
        df1 = build_historical_chirps("KE-039-NYANDO", -0.17, 34.92)
        df2 = build_historical_chirps("KE-039-NYANDO", -0.17, 34.92)
        pd.testing.assert_frame_equal(df1, df2)

    def test_historical_data_has_realistic_range(self) -> None:
        df = build_historical_chirps("KE-039-NYANDO", -0.17, 34.92)
        assert df["precipitation_mm"].min() >= 0
        assert df["precipitation_mm"].max() <= 120  # Realistic daily max
        assert len(df) == 90

    def test_negative_precipitation_rejected(self) -> None:
        with pytest.raises(ValueError, match="negative"):
            ChirpsRainfallRecord("KE-039-TEST", pd.Timestamp("2026-01-01").date(), -5.0, "test", 0, 0)

    def test_rainfall_anomaly_computation(self) -> None:
        assert compute_rainfall_anomaly(10.0, 5.0) == 2.0
        assert compute_rainfall_anomaly(5.0, 10.0) == 0.5
        assert compute_rainfall_anomaly(10.0, 10.0) == 1.0

    def test_rainfall_anomaly_rejects_zero_mean(self) -> None:
        with pytest.raises(ValueError, match="positive"):
            compute_rainfall_anomaly(10.0, 0.0)

    def test_rainfall_anomaly_rejects_negative(self) -> None:
        with pytest.raises(ValueError, match="negative"):
            compute_rainfall_anomaly(-1.0, 5.0)


# ── Feature engineering tests ───────────────────────────────────────


class TestWardProfiles:
    def test_demo_profiles_have_valid_ranges(self) -> None:
        for ward_id, profile in DEMO_WARD_PROFILES.items():
            assert 0 <= profile.flood_plain_fraction <= 1, f"{ward_id} flood_plain_fraction out of range"
            assert 0 <= profile.population_density_norm <= 1, f"{ward_id} population_density_norm out of range"
            assert 0 <= profile.poverty_fraction <= 1, f"{ward_id} poverty_fraction out of range"

    def test_invalid_profile_rejected(self) -> None:
        with pytest.raises(ValueError):
            WardStaticProfile("bad", flood_plain_fraction=1.5, population_density_norm=0.5,
                            poverty_fraction=0.5, elevation_exposure=0.5, historical_flood_frequency=0.5)


class TestFeatureEngineering:
    def _make_test_data(self):
        station = LAKE_VICTORIA_STATIONS[0]
        weather, discharge = build_deterministic_forecast(station)
        historical = build_historical_chirps(station.ward_id, station.latitude, station.longitude)
        return weather, discharge, historical

    def test_hazard_features_in_valid_range(self) -> None:
        weather, discharge, historical = self._make_test_data()
        features = compute_hazard_features(weather, discharge, historical)

        assert features["precip_3day_sum"] >= 0
        assert features["precip_5day_sum"] >= features["precip_3day_sum"]
        assert features["discharge_ratio"] >= 0
        assert 0 <= features["antecedent_moisture"] <= 1

    def test_exposure_score_bounded(self) -> None:
        for profile in DEMO_WARD_PROFILES.values():
            score = compute_exposure_score(profile)
            assert 0 <= score <= 1, f"Exposure score out of range for {profile.ward_id}"

    def test_vulnerability_score_bounded(self) -> None:
        for profile in DEMO_WARD_PROFILES.values():
            score = compute_vulnerability_score(profile)
            assert 0 <= score <= 1, f"Vulnerability score out of range for {profile.ward_id}"

    def test_full_feature_vector_has_all_features(self) -> None:
        weather, discharge, historical = self._make_test_data()
        profile = DEMO_WARD_PROFILES["KE-039-NYANDO"]
        features = build_feature_vector(weather, discharge, historical, profile)

        for name in FEATURE_NAMES:
            assert name in features, f"Missing feature: {name}"

    def test_empty_dataframe_rejected(self) -> None:
        empty = pd.DataFrame()
        with pytest.raises(ValueError, match="must not be empty"):
            compute_hazard_features(empty, empty, empty)


# ── Model tests ─────────────────────────────────────────────────────


class TestTrainingData:
    def test_generates_correct_count(self) -> None:
        features, labels = generate_training_data(n_samples=100)
        assert len(features) == 100
        assert len(labels) == 100

    def test_is_deterministic(self) -> None:
        f1, l1 = generate_training_data(n_samples=50, seed=42)
        f2, l2 = generate_training_data(n_samples=50, seed=42)
        pd.testing.assert_frame_equal(f1, f2)
        pd.testing.assert_series_equal(l1, l2)

    def test_has_both_classes(self) -> None:
        _, labels = generate_training_data(n_samples=200)
        assert labels.sum() > 0, "No positive samples"
        assert labels.sum() < len(labels), "No negative samples"

    def test_has_all_feature_columns(self) -> None:
        features, _ = generate_training_data(n_samples=50)
        for name in FEATURE_NAMES:
            assert name in features.columns, f"Missing feature column: {name}"


class TestFloodRiskModel:
    @pytest.fixture
    def trained_model(self) -> FloodRiskModel:
        features, labels = generate_training_data(n_samples=300)
        model = FloodRiskModel()
        model.train(features, labels)
        return model

    def test_training_produces_valid_metrics(self, trained_model: FloodRiskModel) -> None:
        assert trained_model.is_trained
        assert trained_model.metrics is not None
        assert 0 <= trained_model.metrics.accuracy <= 1
        assert 0 <= trained_model.metrics.f1 <= 1
        assert 0 <= trained_model.metrics.auc_roc <= 1

    def test_model_achieves_minimum_accuracy(self, trained_model: FloodRiskModel) -> None:
        # With calibrated synthetic data and XGBoost, we should get >70% accuracy
        assert trained_model.metrics is not None
        assert trained_model.metrics.accuracy >= 0.70, (
            f"Model accuracy {trained_model.metrics.accuracy} is below minimum threshold"
        )

    def test_prediction_returns_valid_output(self, trained_model: FloodRiskModel) -> None:
        features = {name: 0.5 for name in FEATURE_NAMES}
        features["precip_3day_sum"] = 120.0
        features["precip_5day_sum"] = 180.0
        features["precip_max_daily"] = 70.0
        features["discharge_ratio"] = 2.0
        features["discharge_trend"] = 15.0
        features["rainfall_anomaly"] = 2.0

        prediction = trained_model.predict(features, "KE-039-NYANDO")

        assert 0 <= prediction.score <= 100
        assert prediction.band in ("low", "moderate", "high", "severe")
        assert 0 <= prediction.probability <= 1
        assert len(prediction.explanation) > 0
        assert prediction.ward_id == "KE-039-NYANDO"

    def test_high_risk_input_produces_high_score(self, trained_model: FloodRiskModel) -> None:
        # Extreme flood conditions should produce a high risk score
        features = {
            "precip_3day_sum": 200.0,
            "precip_5day_sum": 300.0,
            "precip_max_daily": 90.0,
            "discharge_ratio": 3.0,
            "discharge_trend": 25.0,
            "rainfall_anomaly": 2.5,
            "antecedent_moisture": 0.9,
            "exposure_score": 0.8,
            "vulnerability_score": 0.7,
            "flood_plain_fraction": 0.85,
            "historical_flood_frequency": 0.9,
        }
        prediction = trained_model.predict(features, "KE-039-NYANDO")
        assert prediction.score >= 50, f"Expected high score for flood conditions, got {prediction.score}"

    def test_low_risk_input_produces_low_score(self, trained_model: FloodRiskModel) -> None:
        # Dry conditions should produce a low risk score
        features = {
            "precip_3day_sum": 10.0,
            "precip_5day_sum": 15.0,
            "precip_max_daily": 5.0,
            "discharge_ratio": 0.4,
            "discharge_trend": -5.0,
            "rainfall_anomaly": 0.4,
            "antecedent_moisture": 0.15,
            "exposure_score": 0.3,
            "vulnerability_score": 0.2,
            "flood_plain_fraction": 0.2,
            "historical_flood_frequency": 0.1,
        }
        prediction = trained_model.predict(features, "KE-039-RACHUONYO")
        assert prediction.score <= 50, f"Expected low score for dry conditions, got {prediction.score}"

    def test_prediction_rejects_missing_features(self, trained_model: FloodRiskModel) -> None:
        incomplete = {"precip_3day_sum": 100.0}
        with pytest.raises(ValueError, match="Missing"):
            trained_model.predict(incomplete, "KE-039-NYANDO")

    def test_untrained_model_rejects_prediction(self) -> None:
        model = FloodRiskModel()
        with pytest.raises(RuntimeError, match="trained"):
            model.predict({name: 0.5 for name in FEATURE_NAMES}, "test")

    def test_save_and_load_roundtrip(self, trained_model: FloodRiskModel, tmp_path: Path) -> None:
        trained_model.save(tmp_path)

        loaded = FloodRiskModel()
        loaded.load(tmp_path)
        assert loaded.is_trained

        # Same prediction from both models
        features = {name: 0.5 for name in FEATURE_NAMES}
        features["precip_3day_sum"] = 120.0
        features["precip_5day_sum"] = 180.0
        features["precip_max_daily"] = 70.0

        p1 = trained_model.predict(features, "test")
        p2 = loaded.predict(features, "test")
        assert p1.score == p2.score
        assert p1.band == p2.band


# ── API tests ───────────────────────────────────────────────────────


class TestAPI:
    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from src.api.serve import app
        with TestClient(app) as c:
            yield c

    def test_health_endpoint(self, client) -> None:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["model_loaded"] is True
        assert len(data["wards_available"]) >= 5

    def test_predict_single_ward(self, client) -> None:
        response = client.post("/predict", json={"ward_id": "KE-039-NYANDO"})
        assert response.status_code == 200
        data = response.json()
        assert data["ward_id"] == "KE-039-NYANDO"
        assert 0 <= data["score"] <= 100
        assert data["band"] in ("low", "moderate", "high", "severe")
        assert len(data["explanation"]) > 0
        assert data["inputs_hash"] != ""

    def test_predict_unknown_ward_returns_404(self, client) -> None:
        response = client.post("/predict", json={"ward_id": "NONEXISTENT"})
        assert response.status_code == 404

    def test_predict_all_wards(self, client) -> None:
        response = client.get("/predict/all")
        assert response.status_code == 200
        data = response.json()
        assert len(data["wards"]) >= 5
        ward_ids = {w["ward_id"] for w in data["wards"]}
        assert "KE-039-NYANDO" in ward_ids
        assert "KE-039-BUDALANGI" in ward_ids

    def test_list_wards(self, client) -> None:
        response = client.get("/wards")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 5

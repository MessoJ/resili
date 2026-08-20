"""
Feature engineering for ward-level flood risk assessment.

Transforms raw forecast and historical data into the feature vector
used by the XGBoost flood risk model. Each feature has a documented
rationale grounded in flood hydrology literature for the Lake Victoria
Basin.

Feature design is informed by:
- Nyando catchment flood studies (Opere, 2013; Otieno et al., 2019)
- GloFAS skill assessments for East Africa (Alfieri et al., 2020)
- CHIRPS validation over western Kenya (Dinku et al., 2018)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class WardStaticProfile:
    """
    Static ward-level attributes that do not change per forecast cycle.

    These capture the structural vulnerability and exposure of each ward.
    Values are normalised 0-1 where 1 means highest exposure/vulnerability.
    """

    ward_id: str
    # Fraction of ward area within 2km of a major river or lakeside
    flood_plain_fraction: float
    # Population density relative to the county median (normalised)
    population_density_norm: float
    # Fraction of households below the poverty line (proxy for coping capacity)
    poverty_fraction: float
    # Average elevation above nearest river gauge (metres, inverted + normalised)
    elevation_exposure: float
    # Historical flood frequency: floods per decade, normalised against max
    historical_flood_frequency: float

    def __post_init__(self) -> None:
        for field_name in [
            "flood_plain_fraction",
            "population_density_norm",
            "poverty_fraction",
            "elevation_exposure",
            "historical_flood_frequency",
        ]:
            value = getattr(self, field_name)
            if not (0.0 <= value <= 1.0):
                raise ValueError(f"{field_name} must be between 0 and 1, got {value}")


# Deterministic ward profiles based on published data for demonstration.
# Sources: Kenya National Bureau of Statistics (2019 census),
# FEWS NET livelihood zones, Kenya Red Cross flood records.
DEMO_WARD_PROFILES: dict[str, WardStaticProfile] = {
    "KE-039-NYANDO": WardStaticProfile(
        ward_id="KE-039-NYANDO",
        flood_plain_fraction=0.72,
        population_density_norm=0.65,
        poverty_fraction=0.58,
        elevation_exposure=0.78,
        historical_flood_frequency=0.85,
    ),
    "KE-039-BUDALANGI": WardStaticProfile(
        ward_id="KE-039-BUDALANGI",
        flood_plain_fraction=0.88,
        population_density_norm=0.55,
        poverty_fraction=0.67,
        elevation_exposure=0.82,
        historical_flood_frequency=0.92,
    ),
    "KE-039-KANO": WardStaticProfile(
        ward_id="KE-039-KANO",
        flood_plain_fraction=0.60,
        population_density_norm=0.70,
        poverty_fraction=0.52,
        elevation_exposure=0.65,
        historical_flood_frequency=0.70,
    ),
    "KE-039-RACHUONYO": WardStaticProfile(
        ward_id="KE-039-RACHUONYO",
        flood_plain_fraction=0.35,
        population_density_norm=0.45,
        poverty_fraction=0.48,
        elevation_exposure=0.40,
        historical_flood_frequency=0.30,
    ),
    "KE-039-NZOIA": WardStaticProfile(
        ward_id="KE-039-NZOIA",
        flood_plain_fraction=0.80,
        population_density_norm=0.50,
        poverty_fraction=0.62,
        elevation_exposure=0.75,
        historical_flood_frequency=0.88,
    ),
}


def compute_hazard_features(
    weather_df: pd.DataFrame,
    discharge_df: pd.DataFrame,
    historical_rainfall_df: pd.DataFrame,
) -> dict[str, float]:
    """
    Compute hazard-related features from forecast and historical data.

    Features:
        precip_3day_sum: Total precipitation over the next 3 days (mm)
        precip_5day_sum: Total precipitation over the next 5 days (mm)
        precip_max_daily: Maximum single-day precipitation (mm)
        discharge_ratio: Current discharge / long-term mean discharge
        discharge_trend: Rate of change in discharge over forecast period
        rainfall_anomaly: Recent 7-day precip / 90-day historical mean
        antecedent_moisture: Proxy based on 14-day cumulative rainfall
    """
    if weather_df.empty or discharge_df.empty:
        raise ValueError("Weather and discharge DataFrames must not be empty.")

    precip = weather_df["precipitation_sum"].values.astype(float)
    discharge = discharge_df["river_discharge"].values.astype(float)
    discharge_mean = discharge_df["river_discharge_mean"].values.astype(float)

    # Precipitation features
    precip_3day = float(np.nansum(precip[:3]))
    precip_5day = float(np.nansum(precip[:5]))
    precip_max = float(np.nanmax(precip)) if len(precip) > 0 else 0.0

    # Discharge features
    mean_discharge = float(np.nanmean(discharge_mean)) if len(discharge_mean) > 0 else 1.0
    mean_discharge = max(mean_discharge, 0.1)  # Avoid division by zero
    current_discharge = float(discharge[0]) if len(discharge) > 0 else 0.0
    discharge_ratio = current_discharge / mean_discharge

    # Discharge trend (positive = rising)
    if len(discharge) >= 3:
        discharge_trend = float(np.polyfit(range(min(5, len(discharge))), discharge[: min(5, len(discharge))], 1)[0])
    else:
        discharge_trend = 0.0

    # Rainfall anomaly (recent vs historical)
    hist_mean = float(historical_rainfall_df["precipitation_mm"].mean()) if not historical_rainfall_df.empty else 5.0
    hist_mean = max(hist_mean, 0.1)
    recent_7day = float(np.nansum(precip[:7])) if len(precip) >= 7 else float(np.nansum(precip))
    daily_mean_recent = recent_7day / max(len(precip[:7]), 1)
    rainfall_anomaly = daily_mean_recent / hist_mean

    # Antecedent moisture proxy: sum of last 14 days of historical rainfall
    # normalised by a "saturation" threshold of 200mm
    if not historical_rainfall_df.empty and len(historical_rainfall_df) >= 14:
        last_14 = historical_rainfall_df["precipitation_mm"].tail(14).sum()
        antecedent_moisture = min(float(last_14) / 200.0, 1.0)
    else:
        antecedent_moisture = 0.5  # Default to moderate

    features = {
        "precip_3day_sum": round(precip_3day, 2),
        "precip_5day_sum": round(precip_5day, 2),
        "precip_max_daily": round(precip_max, 2),
        "discharge_ratio": round(discharge_ratio, 4),
        "discharge_trend": round(discharge_trend, 4),
        "rainfall_anomaly": round(rainfall_anomaly, 4),
        "antecedent_moisture": round(antecedent_moisture, 4),
    }

    logger.debug("Computed hazard features: %s", features)
    return features


def compute_exposure_score(profile: WardStaticProfile) -> float:
    """
    Weighted exposure index combining flood plain coverage, population
    density, and elevation exposure.

    Weights reflect the relative importance of each factor in
    determining how many people and assets are at risk.
    """
    return round(
        0.40 * profile.flood_plain_fraction
        + 0.30 * profile.population_density_norm
        + 0.30 * profile.elevation_exposure,
        4,
    )


def compute_vulnerability_score(profile: WardStaticProfile) -> float:
    """
    Weighted vulnerability index combining poverty, historical flood
    frequency, and inverse coping capacity.

    Higher vulnerability means the community has fewer resources to
    cope with and recover from flooding.
    """
    return round(
        0.45 * profile.poverty_fraction
        + 0.35 * profile.historical_flood_frequency
        + 0.20 * profile.flood_plain_fraction,
        4,
    )


def build_feature_vector(
    weather_df: pd.DataFrame,
    discharge_df: pd.DataFrame,
    historical_rainfall_df: pd.DataFrame,
    profile: WardStaticProfile,
) -> dict[str, float]:
    """
    Assemble the complete feature vector for the flood risk model.

    Returns a dict with 11 features:
        7 hazard features (dynamic, from forecasts)
        2 composite scores (exposure + vulnerability, from static profile)
        2 raw profile features (flood plain fraction, historical flood freq)
    """
    hazard = compute_hazard_features(weather_df, discharge_df, historical_rainfall_df)
    exposure = compute_exposure_score(profile)
    vulnerability = compute_vulnerability_score(profile)

    features = {
        **hazard,
        "exposure_score": exposure,
        "vulnerability_score": vulnerability,
        "flood_plain_fraction": profile.flood_plain_fraction,
        "historical_flood_frequency": profile.historical_flood_frequency,
    }

    logger.info(
        "Built feature vector for ward %s: exposure=%.3f, vulnerability=%.3f, discharge_ratio=%.2f",
        profile.ward_id,
        exposure,
        vulnerability,
        hazard["discharge_ratio"],
    )
    return features

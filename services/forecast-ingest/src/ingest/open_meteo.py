"""
Open-Meteo and GloFAS river discharge data client.

Fetches forecast and historical weather/hydrology data for wards in the
Lake Victoria Basin. GloFAS (Global Flood Awareness System) discharge
data is accessed through the Open-Meteo Flood API, which mirrors
Copernicus GloFAS outputs with no API key required.

Data attribution: GloFAS is produced by ECMWF under the Copernicus
Emergency Management Service. Open-Meteo provides free access under
CC-BY 4.0.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Final

import httpx
import pandas as pd

logger = logging.getLogger(__name__)

OPEN_METEO_FORECAST_URL: Final[str] = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_FLOOD_URL: Final[str] = "https://flood-api.open-meteo.com/v1/flood"
REQUEST_TIMEOUT_SECONDS: Final[float] = 30.0


@dataclass(frozen=True, slots=True)
class StationCoordinate:
    """A point location used to query gridded forecast data."""

    station_id: str
    ward_id: str
    latitude: float
    longitude: float

    def __post_init__(self) -> None:
        if not (-90 <= self.latitude <= 90):
            raise ValueError(f"Latitude {self.latitude} out of range for station {self.station_id}")
        if not (-180 <= self.longitude <= 180):
            raise ValueError(f"Longitude {self.longitude} out of range for station {self.station_id}")


# Key stations around the Nyando, Nzoia, and Yala catchments.
# Coordinates approximate the centroid of each ward or the nearest
# river gauge location. These are used for API queries, not for
# public display (ward-level generalisation per SECURITY.md).
LAKE_VICTORIA_STATIONS: Final[list[StationCoordinate]] = [
    StationCoordinate("nyando-ahero", "KE-039-NYANDO", latitude=-0.1725, longitude=34.9192),
    StationCoordinate("budalangi-bunyala", "KE-039-BUDALANGI", latitude=0.1208, longitude=34.0833),
    StationCoordinate("kano-plains", "KE-039-KANO", latitude=-0.1000, longitude=34.8500),
    StationCoordinate("rachuonyo-east", "KE-039-RACHUONYO", latitude=-0.3833, longitude=34.7500),
    StationCoordinate("nzoia-mouth", "KE-039-NZOIA", latitude=0.0833, longitude=34.0167),
]


async def fetch_weather_forecast(
    station: StationCoordinate,
    *,
    forecast_days: int = 7,
    client: httpx.AsyncClient | None = None,
) -> pd.DataFrame:
    """
    Fetch daily weather forecast from Open-Meteo for a single station.

    Returns a DataFrame with columns:
        date, temperature_2m_max, precipitation_sum, wind_speed_10m_max
    """
    params = {
        "latitude": station.latitude,
        "longitude": station.longitude,
        "daily": "temperature_2m_max,precipitation_sum,wind_speed_10m_max",
        "forecast_days": forecast_days,
        "timezone": "Africa/Nairobi",
    }

    should_close = client is None
    client = client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
    try:
        response = await client.get(OPEN_METEO_FORECAST_URL, params=params)
        response.raise_for_status()
        data = response.json()
    finally:
        if should_close:
            await client.aclose()

    daily = data.get("daily", {})
    df = pd.DataFrame(
        {
            "date": pd.to_datetime(daily.get("time", [])),
            "temperature_2m_max": daily.get("temperature_2m_max", []),
            "precipitation_sum": daily.get("precipitation_sum", []),
            "wind_speed_10m_max": daily.get("wind_speed_10m_max", []),
        }
    )
    df["station_id"] = station.station_id
    df["ward_id"] = station.ward_id
    df["fetched_at"] = datetime.now(timezone.utc).isoformat()
    df["source"] = "open-meteo-forecast"

    logger.info(
        "Fetched %d-day weather forecast for station %s (ward %s)",
        len(df),
        station.station_id,
        station.ward_id,
    )
    return df


async def fetch_river_discharge(
    station: StationCoordinate,
    *,
    forecast_days: int = 7,
    client: httpx.AsyncClient | None = None,
) -> pd.DataFrame:
    """
    Fetch GloFAS river discharge forecast from Open-Meteo Flood API.

    Returns a DataFrame with columns:
        date, river_discharge, river_discharge_mean, river_discharge_max
    """
    params = {
        "latitude": station.latitude,
        "longitude": station.longitude,
        "daily": "river_discharge,river_discharge_mean,river_discharge_max",
        "forecast_days": forecast_days,
    }

    should_close = client is None
    client = client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
    try:
        response = await client.get(OPEN_METEO_FLOOD_URL, params=params)
        response.raise_for_status()
        data = response.json()
    finally:
        if should_close:
            await client.aclose()

    daily = data.get("daily", {})
    df = pd.DataFrame(
        {
            "date": pd.to_datetime(daily.get("time", [])),
            "river_discharge": daily.get("river_discharge", []),
            "river_discharge_mean": daily.get("river_discharge_mean", []),
            "river_discharge_max": daily.get("river_discharge_max", []),
        }
    )
    df["station_id"] = station.station_id
    df["ward_id"] = station.ward_id
    df["fetched_at"] = datetime.now(timezone.utc).isoformat()
    df["source"] = "open-meteo-glofas"

    logger.info(
        "Fetched %d-day discharge forecast for station %s (ward %s)",
        len(df),
        station.station_id,
        station.ward_id,
    )
    return df


def build_deterministic_forecast(
    station: StationCoordinate,
    base_date: date | None = None,
    *,
    forecast_days: int = 7,
    precipitation_mm: float = 85.0,
    discharge_m3s: float = 180.0,
    discharge_mean_m3s: float = 95.0,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Build deterministic forecast fixtures for demo and testing.

    Returns (weather_df, discharge_df) with realistic but fixed values
    that always produce the same risk score. This keeps the demo
    credible when external APIs are unavailable.
    """
    base = base_date or date(2026, 8, 20)
    dates = pd.date_range(start=base, periods=forecast_days, freq="D")
    now_utc = datetime.now(timezone.utc).isoformat()

    weather = pd.DataFrame(
        {
            "date": dates,
            "temperature_2m_max": [28.5 + (i * 0.3) for i in range(forecast_days)],
            "precipitation_sum": [precipitation_mm * (0.6 + 0.1 * i) for i in range(forecast_days)],
            "wind_speed_10m_max": [12.0 + i for i in range(forecast_days)],
            "station_id": station.station_id,
            "ward_id": station.ward_id,
            "fetched_at": now_utc,
            "source": "deterministic-demo-fixture",
        }
    )

    discharge = pd.DataFrame(
        {
            "date": dates,
            "river_discharge": [discharge_m3s * (0.8 + 0.06 * i) for i in range(forecast_days)],
            "river_discharge_mean": [discharge_mean_m3s] * forecast_days,
            "river_discharge_max": [discharge_m3s * 1.4] * forecast_days,
            "station_id": station.station_id,
            "ward_id": station.ward_id,
            "fetched_at": now_utc,
            "source": "deterministic-demo-fixture",
        }
    )

    logger.info(
        "Built deterministic %d-day forecast for station %s",
        forecast_days,
        station.station_id,
    )
    return weather, discharge

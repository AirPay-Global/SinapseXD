"""Open-Meteo provider — free, keyless, global marine + weather forecast.

Chosen over NOAA (api.weather.gov is US-only — no African coastal coverage)
and over StormGlass (10 requests/day on the free tier, too thin for hourly
polling across 7 pilot ports). Open-Meteo's marine + forecast APIs are free
for non-commercial/low-volume use with no key, no signup — the right default
until a paid StormGlass key is worth provisioning.

API shape:
  GET https://marine-api.open-meteo.com/v1/marine
    latitude/longitude, current=wave_height,wind_wave_height
  GET https://api.open-meteo.com/v1/forecast
    latitude/longitude, current_weather=true   -> windspeed (km/h), time
  Two calls per port (wave data and surface wind live on separate Open-Meteo
  products); both keyless and free.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

KMH_TO_KN = 0.539957

# Simple threshold model — not a met-office risk score, just enough signal
# to flag "watch this port" on the dashboard.
_WAVE_HIGH_M = 2.5
_WIND_HIGH_KN = 25.0


def _risk(wave_m: float, wind_kn: float) -> str:
    if wave_m >= _WAVE_HIGH_M or wind_kn >= _WIND_HIGH_KN:
        return "elevated"
    return "normal"


class OpenMeteoProvider:
    queue_name = "weather.marine.forecast"

    def __init__(self, *, timeout: float = 20.0):
        self.timeout = timeout

    def fetch(self, ports: list[dict]) -> list[dict]:
        """`ports`: [{id, name, lat, lng}, ...] — the pilot port registry."""
        rows: list[dict] = []
        for port in ports:
            try:
                marine = httpx.get(
                    MARINE_URL,
                    params={
                        "latitude": port["lat"], "longitude": port["lng"],
                        "current": "wave_height,wind_wave_height",
                        "timezone": "UTC",
                    },
                    timeout=self.timeout,
                ).json()
                forecast = httpx.get(
                    FORECAST_URL,
                    params={
                        "latitude": port["lat"], "longitude": port["lng"],
                        "current_weather": "true",
                        "timezone": "UTC",
                    },
                    timeout=self.timeout,
                ).json()
            except Exception:
                logger.exception("Open-Meteo fetch failed for port %s", port.get("id"))
                continue
            rows.append({"port": port, "marine": marine, "forecast": forecast})
        logger.info("Open-Meteo: fetched conditions for %d ports", len(rows))
        return rows

    @staticmethod
    def normalise(raw: dict) -> dict:
        port = raw["port"]
        marine_current = (raw.get("marine") or {}).get("current") or {}
        forecast_current = (raw.get("forecast") or {}).get("current_weather") or {}

        wave_m = float(marine_current.get("wave_height") or 0.0)
        wind_kmh = float(forecast_current.get("windspeed") or 0.0)
        wind_kn = round(wind_kmh * KMH_TO_KN, 1)
        ts = forecast_current.get("time") or datetime.now(timezone.utc).isoformat()

        return {
            "portId": port["id"],
            "waveHeightM": round(wave_m, 2),
            "windSpeedKn": wind_kn,
            "disruptionRisk": _risk(wave_m, wind_kn),
            "tsIso": ts,
            "source": "open-meteo",
        }

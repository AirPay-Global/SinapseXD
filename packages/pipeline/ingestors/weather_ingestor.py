"""Marine conditions for the 7 pilot ports (hourly).

Queue: `weather.marine.forecast`. Default provider is Open-Meteo — free,
keyless, and global (unlike api.weather.gov, which only covers the US).
STORMGLASS_API_KEY stays reserved in .env.example for a future paid-tier
swap (set WEATHER_PROVIDER=stormglass once that provider is wired) — same
pattern as AIS_PROVIDER.
"""
from __future__ import annotations

import logging
import os

from .base_ingestor import BaseIngestor
from .providers.open_meteo import OpenMeteoProvider

logger = logging.getLogger(__name__)

# Mirrors the ont_port seed in supabase/migrations/0002_ontology_core.sql.
PILOT_PORTS: list[dict] = [
    {"id": "durban", "name": "Durban", "lat": -29.87, "lng": 31.03},
    {"id": "mombasa", "name": "Mombasa", "lat": -4.06, "lng": 39.65},
    {"id": "lagos", "name": "Lagos (Apapa)", "lat": 6.44, "lng": 3.36},
    {"id": "lome", "name": "Lomé", "lat": 6.13, "lng": 1.29},
    {"id": "djibouti", "name": "Djibouti", "lat": 11.60, "lng": 43.15},
    {"id": "dar", "name": "Dar es Salaam", "lat": -6.82, "lng": 39.29},
    {"id": "tema", "name": "Tema", "lat": 5.63, "lng": 0.01},
]


class WeatherIngestor(BaseIngestor):
    queue_name = "weather.marine.forecast"
    pillar = "weather"

    def __init__(self) -> None:
        provider = os.environ.get("WEATHER_PROVIDER", "open-meteo").lower()
        if provider == "open-meteo":
            self.provider = OpenMeteoProvider()
        else:
            raise ValueError(f"Unknown WEATHER_PROVIDER: {provider!r} (only 'open-meteo' wired so far)")
        self.source = provider
        self.ports = PILOT_PORTS

    def fetch(self) -> list[dict]:
        return self.provider.fetch(self.ports)

    def normalise(self, raw: dict) -> dict:
        return self.provider.normalise(raw)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    WeatherIngestor().run()

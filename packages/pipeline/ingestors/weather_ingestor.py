"""StormGlass/NOAA marine conditions (hourly).

Pillar ingestor stub — fetch() wires to the live API once credentials are
provisioned (see API_REGISTRATIONS.md). Queue: `weather.marine.forecast`.
"""
from __future__ import annotations

import logging

from .base_ingestor import BaseIngestor

logger = logging.getLogger(__name__)


class WeatherIngestor(BaseIngestor):
    queue_name = "weather.marine.forecast"

    def fetch(self) -> list[dict]:
        # TODO: call the external API with the key from the environment
        # (STORMGLASS_API_KEY).
        logger.warning("%s: fetch() not yet wired to live API", type(self).__name__)
        return []

    def normalise(self, raw: dict) -> dict:
        return raw


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    WeatherIngestor().run()

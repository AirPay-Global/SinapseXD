"""MarineTraffic/Spire real-time vessel positions.

Pillar ingestor stub — fetch() wires to the live API once credentials are
provisioned (see API_REGISTRATIONS.md). Queue: `ais.vessel.positions`.
"""
from __future__ import annotations

import logging

from .base_ingestor import BaseIngestor

logger = logging.getLogger(__name__)


class AisIngestor(BaseIngestor):
    queue_name = "ais.vessel.positions"

    def fetch(self) -> list[dict]:
        # TODO: call the external API with the key from the environment
        # (MARINETRAFFIC_API_KEY).
        logger.warning("%s: fetch() not yet wired to live API", type(self).__name__)
        return []

    def normalise(self, raw: dict) -> dict:
        return raw


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    AisIngestor().run()

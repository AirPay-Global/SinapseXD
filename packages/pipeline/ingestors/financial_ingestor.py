"""IMF/World Bank economic indicators (daily).

Pillar ingestor stub — fetch() wires to the live API once credentials are
provisioned (see API_REGISTRATIONS.md). Queue: `financial.port.data`.
"""
from __future__ import annotations

import logging

from .base_ingestor import BaseIngestor

logger = logging.getLogger(__name__)


class FinancialIngestor(BaseIngestor):
    queue_name = "financial.port.data"

    def fetch(self) -> list[dict]:
        # TODO: call the external API with the key from the environment
        # (ALPHA_VANTAGE_API_KEY).
        logger.warning("%s: fetch() not yet wired to live API", type(self).__name__)
        return []

    def normalise(self, raw: dict) -> dict:
        return raw


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    FinancialIngestor().run()

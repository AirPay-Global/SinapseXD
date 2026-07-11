"""Freightos Baltic Index — global container freight benchmark (4-hourly).

Queue: `market.freight.rates`. Free registration required
(FREIGHTOS_API_KEY) — idle by default, same pattern as AIS/Trade.
"""
from __future__ import annotations

import logging
import os

from .base_ingestor import BaseIngestor
from .providers.freightos import FreightosProvider

logger = logging.getLogger(__name__)


class MarketIngestor(BaseIngestor):
    queue_name = "market.freight.rates"
    pillar = "market"

    def __init__(self) -> None:
        provider = os.environ.get("MARKET_PROVIDER", "freightos").lower()
        if provider == "freightos":
            self.provider = FreightosProvider()
        else:
            raise ValueError(f"Unknown MARKET_PROVIDER: {provider!r} (only 'freightos' wired so far)")
        self.source = provider

    def fetch(self) -> list[dict]:
        return self.provider.fetch()

    def normalise(self, raw: dict) -> dict:
        return self.provider.normalise(raw)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    MarketIngestor().run()

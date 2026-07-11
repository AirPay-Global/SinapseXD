"""World Bank economic indicators — GDP, GDP growth, trade openness (daily).

Queue: `financial.port.data` (kept as-is — matches the existing render.yaml
cron). Free, keyless public API, so this pillar is live as soon as the
worker is deployed, no credential provisioning needed.
"""
from __future__ import annotations

import logging
import os

from .base_ingestor import BaseIngestor
from .providers.worldbank import WorldBankProvider

logger = logging.getLogger(__name__)


class FinancialIngestor(BaseIngestor):
    queue_name = "financial.port.data"
    pillar = "financial"

    def __init__(self) -> None:
        provider = os.environ.get("FINANCIAL_PROVIDER", "worldbank").lower()
        if provider == "worldbank":
            self.provider = WorldBankProvider()
        else:
            raise ValueError(f"Unknown FINANCIAL_PROVIDER: {provider!r} (only 'worldbank' wired so far)")
        self.source = provider

    def fetch(self) -> list[dict]:
        return self.provider.fetch()

    def normalise(self, raw: dict) -> dict:
        return self.provider.normalise(raw)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    FinancialIngestor().run()

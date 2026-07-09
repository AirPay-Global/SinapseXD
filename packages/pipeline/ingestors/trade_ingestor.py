"""UN Comtrade bilateral trade flows for AfCFTA corridor country-pairs.

Queue: `trade.corridor.flows`. Runs as a Render daily cron (Comtrade data is
annual/lagged, so hourly+ polling would be wasted calls) — see render.yaml.
No key set means the worker stays idle and dashboards render from demo data
(per the standalone-XD build focus).
"""
from __future__ import annotations

import logging
import os

from .base_ingestor import BaseIngestor
from .providers.comtrade import ComtradeProvider

logger = logging.getLogger(__name__)


class TradeIngestor(BaseIngestor):
    queue_name = "trade.corridor.flows"
    pillar = "trade"

    def __init__(self) -> None:
        provider = os.environ.get("TRADE_PROVIDER", "comtrade").lower()
        if provider == "comtrade":
            self.provider = ComtradeProvider()
        else:
            raise ValueError(f"Unknown TRADE_PROVIDER: {provider!r} (only 'comtrade' wired so far)")
        self.source = provider

    def fetch(self) -> list[dict]:
        return self.provider.fetch()

    def normalise(self, raw: dict) -> dict:
        return self.provider.normalise(raw)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    TradeIngestor().run()

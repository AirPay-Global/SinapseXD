"""Daily port-activity ingestor. Queue: `port.activity.daily`.

Source: IMF PortWatch (open, no key). Powers the Port dashboard's port-call
and throughput-by-commodity cards with real daily data. Runs as a daily cron
(the upstream updates once a day). Gated on PORTWATCH_ENABLED so it stays
idle by default and dashboards keep rendering demo data.
"""
from __future__ import annotations

import logging
import os

from .base_ingestor import BaseIngestor
from .providers.portwatch import PortWatchProvider

logger = logging.getLogger(__name__)


class PortActivityIngestor(BaseIngestor):
    queue_name = "port.activity.daily"
    pillar = "port_activity"
    source = "portwatch"

    def __init__(self) -> None:
        self.enabled = os.environ.get("PORTWATCH_ENABLED", "false").lower() == "true"
        self.provider = PortWatchProvider()

    def fetch(self) -> list[dict]:
        if not self.enabled:
            logger.warning("PORTWATCH_ENABLED not true; port-activity ingestor idle")
            return []
        return self.provider.fetch()

    def normalise(self, raw: dict) -> dict:
        return self.provider.normalise(raw)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    PortActivityIngestor().run()

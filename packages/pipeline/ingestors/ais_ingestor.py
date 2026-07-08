"""AIS vessel-position ingestor. Queue: `ais.vessel.positions`.

Provider-swappable: AISHub (free, dev/testing) is wired now behind the
AisProvider interface; Spire/MarineTraffic (production African coverage)
drop in as additional providers with no change to normalise() or the queue.
Selection is by environment — no key set means the worker stays idle and
dashboards render from demo data (per the standalone-XD build focus).
"""
from __future__ import annotations

import logging
import os

from .base_ingestor import BaseIngestor
from .providers.aishub import AISHubProvider

logger = logging.getLogger(__name__)

# Dev bounding box: African coastline envelope. Spire's production config
# will slice this per-port instead.
AFRICA_BBOX = {"latmin": -35.0, "latmax": 15.0, "lonmin": -20.0, "lonmax": 52.0}


class AisIngestor(BaseIngestor):
    queue_name = "ais.vessel.positions"

    def __init__(self) -> None:
        provider = os.environ.get("AIS_PROVIDER", "aishub").lower()
        if provider == "aishub":
            self.provider = AISHubProvider()
        else:
            raise ValueError(f"Unknown AIS_PROVIDER: {provider!r} (only 'aishub' wired so far)")
        self.bbox = AFRICA_BBOX

    def fetch(self) -> list[dict]:
        return self.provider.fetch(self.bbox)

    def normalise(self, raw: dict) -> dict:
        return self.provider.normalise(raw)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    AisIngestor().run()

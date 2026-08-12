"""AIS vessel-position ingestor. Queue: `ais.vessel.positions`.

Provider-swappable via AIS_PROVIDER: 'kpler' (commercial, production-grade —
default, since this is the AIS key actually provisioned for this account;
built and verified against Kpler's real published OpenAPI spec), 'aishub'
(free, dev/testing fallback), or 'marinetraffic' (built from general public
API knowledge since its docs host is blocked by this environment's egress
policy). Spire drops in the same way later. No change to normalise() or the
queue either way — every provider maps onto the same VesselPosition shape.
No key set means the worker stays idle and dashboards render from demo data
(per the standalone-XD build focus).

Runs as a Render background worker, so it must stay alive: poll_forever()
loops run() on an interval (default 60s, matching AISHub's documented
1-request/minute rate limit — MarineTraffic's quota is plan-dependent, so
raise AIS_POLL_INTERVAL_SECONDS if your plan's hourly call budget needs it)
rather than exiting after a single fetch.
"""
from __future__ import annotations

import logging
import os
import time

from .base_ingestor import BaseIngestor
from .providers.aishub import AISHubProvider
from .providers.kpler import KplerAisProvider
from .providers.marinetraffic import MarineTrafficProvider

logger = logging.getLogger(__name__)

# Dev bounding box: African coastline envelope. Spire's production config
# will slice this per-port instead.
AFRICA_BBOX = {"latmin": -35.0, "latmax": 15.0, "lonmin": -20.0, "lonmax": 52.0}

DEFAULT_POLL_SECONDS = 60.0


class AisIngestor(BaseIngestor):
    queue_name = "ais.vessel.positions"
    pillar = "ais"

    def __init__(self) -> None:
        provider = os.environ.get("AIS_PROVIDER", "kpler").lower()
        if provider == "aishub":
            self.provider = AISHubProvider()
        elif provider == "marinetraffic":
            self.provider = MarineTrafficProvider()
        elif provider == "kpler":
            self.provider = KplerAisProvider()
        else:
            raise ValueError(f"Unknown AIS_PROVIDER: {provider!r} (wired: 'aishub', 'marinetraffic', 'kpler')")
        self.source = provider
        self.bbox = AFRICA_BBOX

    def fetch(self) -> list[dict]:
        return self.provider.fetch(self.bbox)

    def normalise(self, raw: dict) -> dict:
        return self.provider.normalise(raw)

    def poll_forever(self, poll_seconds: float | None = None, max_iterations: int | None = None) -> None:
        """Long-running loop for the Render worker process. A single failed
        iteration is logged and swallowed — a transient fetch/enqueue error
        must not crash the whole worker. max_iterations is test-only, to make
        the loop terminate rather than run forever."""
        interval = poll_seconds if poll_seconds is not None else float(
            os.environ.get("AIS_POLL_INTERVAL_SECONDS", DEFAULT_POLL_SECONDS)
        )
        logger.info("AIS ingestor polling every %.0fs (provider=%s)", interval, self.source)
        i = 0
        while max_iterations is None or i < max_iterations:
            try:
                self.run()
            except Exception:
                logger.exception("AIS ingestor iteration failed; will retry next cycle")
            i += 1
            if max_iterations is None or i < max_iterations:
                time.sleep(interval)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    AisIngestor().poll_forever()


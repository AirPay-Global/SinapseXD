"""UN SDG indicator data for goals 8/9/10/17 (weekly).

Queue: `sdg.indicators`. Free, keyless public API — no credential
provisioning needed, unlike AIS/Trade/Market; this pillar is live as soon as
the worker is deployed.
"""
from __future__ import annotations

import logging
import os

from .base_ingestor import BaseIngestor
from .providers.unsdg import UnSdgProvider

logger = logging.getLogger(__name__)


class SdgIngestor(BaseIngestor):
    queue_name = "sdg.indicators"
    pillar = "sdg"

    def __init__(self) -> None:
        provider = os.environ.get("SDG_PROVIDER", "un-sdg-api").lower()
        if provider == "un-sdg-api":
            self.provider = UnSdgProvider()
        else:
            raise ValueError(f"Unknown SDG_PROVIDER: {provider!r} (only 'un-sdg-api' wired so far)")
        self.source = provider

    def fetch(self) -> list[dict]:
        return self.provider.fetch()

    def normalise(self, raw: dict) -> dict:
        return self.provider.normalise(raw)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    SdgIngestor().run()

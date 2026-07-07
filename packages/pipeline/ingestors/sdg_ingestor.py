"""UN SDG indicator data (weekly).

Pillar ingestor stub — fetch() wires to the live API once credentials are
provisioned (see API_REGISTRATIONS.md). Queue: `sdg.indicators`.
"""
from __future__ import annotations

import logging

from .base_ingestor import BaseIngestor

logger = logging.getLogger(__name__)


class SdgIngestor(BaseIngestor):
    queue_name = "sdg.indicators"

    def fetch(self) -> list[dict]:
        # TODO: call the external API with the key from the environment
        # (no key required — public API).
        logger.warning("%s: fetch() not yet wired to live API", type(self).__name__)
        return []

    def normalise(self, raw: dict) -> dict:
        return raw


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    SdgIngestor().run()

"""Swappable AIS providers.

The AIS pillar can be fed by several vendors with different wire formats but
the same normalised output (the shared VesselPosition shape). Each provider
implements `fetch` (pull raw records for a bounding box) and `normalise`
(map one raw record to the Sinapse XD schema). AisIngestor picks a provider
from the environment, so swapping AISHub (dev) for Spire/MarineTraffic
(production) is a one-line change, not a rewrite.
"""
from __future__ import annotations

from typing import Protocol


class AisProvider(Protocol):
    def fetch(self, bbox: dict[str, float]) -> list[dict]:
        """Pull raw vessel records for a lat/lng bounding box."""

    @staticmethod
    def normalise(raw: dict) -> dict:
        """Map one raw vendor record to the VesselPosition shape."""

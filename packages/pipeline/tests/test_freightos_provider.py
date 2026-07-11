"""Unit tests for the Freightos provider normaliser — no DB/network required."""
from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))

from ingestors.providers.freightos import FreightosProvider  # noqa: E402


def test_normalise_maps_route_and_value():
    raw = {"_route": "global-container-composite", "value": "1850.5", "date": "2026-07-09"}
    rec = FreightosProvider.normalise(raw)
    assert rec["route"] == "global-container-composite"
    assert rec["rateUsd"] == 1850.5
    assert rec["dateIso"] == "2026-07-09"
    assert rec["indexSource"] == "freightos"


def test_fetch_returns_empty_without_api_key(monkeypatch):
    monkeypatch.delenv("FREIGHTOS_API_KEY", raising=False)
    provider = FreightosProvider(api_key="")
    assert provider.fetch() == []

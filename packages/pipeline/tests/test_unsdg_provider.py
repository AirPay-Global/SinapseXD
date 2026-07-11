"""Unit tests for the UN SDG provider normaliser — no DB/network required."""
from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))

from ingestors.providers.unsdg import UnSdgProvider  # noqa: E402


def test_normalise_maps_goal_and_indicator():
    raw = {"_iso3": "KEN", "_goal": 8, "_indicatorCode": "8.1.1", "value": "3.4", "timePeriodStart": 2024}
    rec = UnSdgProvider.normalise(raw)
    assert rec["country"] == "KEN"
    assert rec["goal"] == 8
    assert rec["indicatorCode"] == "8.1.1"
    assert rec["value"] == 3.4
    assert rec["year"] == 2024


def test_normalise_handles_unparseable_value():
    rec = UnSdgProvider.normalise({"_iso3": "GHA", "_goal": 10, "_indicatorCode": "10.1.1", "value": "N/A"})
    assert rec["value"] is None


def test_fetch_swallows_request_errors(monkeypatch):
    import httpx

    def _boom(*args, **kwargs):
        raise httpx.ConnectError("blocked")

    monkeypatch.setattr(httpx, "get", _boom)
    provider = UnSdgProvider(countries=["ZAF"])
    assert provider.fetch() == []  # logged and swallowed, not raised

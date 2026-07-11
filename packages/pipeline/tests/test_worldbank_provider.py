"""Unit tests for the World Bank provider normaliser — no DB/network required."""
from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))

from ingestors.providers.worldbank import WorldBankProvider  # noqa: E402


def test_normalise_maps_country_and_value():
    raw = {"countryiso3code": "zaf", "_label": "gdp_usd", "value": 405e9, "date": "2024"}
    rec = WorldBankProvider.normalise(raw)
    assert rec["country"] == "ZAF"
    assert rec["indicator"] == "gdp_usd"
    assert rec["value"] == 405e9
    assert rec["year"] == "2024"
    assert rec["source"] == "worldbank"


def test_fetch_swallows_request_errors(monkeypatch):
    import httpx

    def _boom(*args, **kwargs):
        raise httpx.ConnectError("blocked")

    monkeypatch.setattr(httpx, "get", _boom)
    provider = WorldBankProvider(countries=["ZAF"], indicators={"NY.GDP.MKTP.CD": "gdp_usd"})
    assert provider.fetch() == []  # logged and swallowed, not raised

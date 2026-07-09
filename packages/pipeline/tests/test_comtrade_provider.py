"""Unit tests for the UN Comtrade provider normaliser — no DB/network required."""
from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))

from ingestors.providers.comtrade import ComtradeProvider  # noqa: E402


def test_normalise_maps_iso_and_value_fields():
    raw = {
        "reporterISO": "zaf", "partnerISO": "zmb", "flowCode": "x",
        "cmdCode": "TOTAL", "period": "2025", "primaryValue": "999.5", "netWgt": 12,
    }
    rec = ComtradeProvider.normalise(raw)
    assert rec["reporterIso3"] == "ZAF"
    assert rec["partnerIso3"] == "ZMB"
    assert rec["flowCode"] == "X"
    assert rec["tradeValueUsd"] == 999.5
    assert rec["netWeightKg"] == 12.0
    assert rec["source"] == "comtrade"


def test_fetch_returns_empty_without_api_key(monkeypatch):
    monkeypatch.delenv("UN_COMTRADE_API_KEY", raising=False)
    provider = ComtradeProvider(api_key="")
    assert provider.fetch() == []

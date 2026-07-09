"""Unit tests for the AISHub provider normaliser — no DB/network required."""
from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))

from ingestors.providers.aishub import AISHubProvider  # noqa: E402


def test_normalise_maps_core_fields_and_parses_time():
    raw = {
        "MMSI": 601234567, "IMO": "9321483", "NAME": "MSC DURBAN",
        "TYPE": 71, "LATITUDE": -29.87, "LONGITUDE": 31.03,
        "SOG": 12.4, "HEADING": 511, "COG": 184.2, "NAVSTAT": 0,
        "DEST": "DURBAN", "ETA": "07151430", "TIME": "20260709141530",
    }
    rec = AISHubProvider.normalise(raw)
    assert rec["mmsi"] == "601234567"
    assert rec["imo"] == "9321483"
    assert rec["name"] == "MSC DURBAN"
    assert rec["type"] == "Cargo"
    assert rec["heading"] == 184  # HEADING unavailable (511) -> falls back to COG
    assert rec["status"] == "underway"
    assert rec["destinationPort"] == "DURBAN"
    assert rec["tsIso"] == "2026-07-09T14:15:30+00:00"
    assert rec["source"] == "aishub"


def test_normalise_falls_back_to_now_on_bad_time():
    rec = AISHubProvider.normalise({"MMSI": 1, "TIME": "not-a-timestamp"})
    assert rec["tsIso"]  # non-empty ISO string, defaulted to ingest time


def test_fetch_returns_empty_without_username(monkeypatch):
    monkeypatch.delenv("AISHUB_USERNAME", raising=False)
    provider = AISHubProvider(username="")
    assert provider.fetch({"latmin": -1, "latmax": 1, "lonmin": -1, "lonmax": 1}) == []

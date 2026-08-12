"""Unit tests for the MarineTraffic provider normaliser — no DB/network
required. Field-shape assumptions here are documented (and flagged as
unverified against a live docs fetch) in providers/marinetraffic.py's module
docstring — these tests pin the behavior actually implemented, not a
guarantee MarineTraffic's live API matches exactly."""
from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))

from ingestors.providers.marinetraffic import MarineTrafficProvider  # noqa: E402


def test_normalise_maps_core_fields_and_parses_iso_timestamp():
    raw = {
        "MMSI": 601234567, "IMO": "9321483", "SHIPNAME": "MSC DURBAN",
        "TYPE_NAME": "Container Ship", "LAT": -29.87, "LON": 31.03,
        "SPEED": 12.4, "HEADING": 511, "COURSE": 184.2, "STATUS": 0,
        "DESTINATION": "DURBAN", "ETA": "07-15 14:30",
        "TIMESTAMP": "2026-07-09T14:15:30",
    }
    rec = MarineTrafficProvider.normalise(raw)
    assert rec["mmsi"] == "601234567"
    assert rec["imo"] == "9321483"
    assert rec["name"] == "MSC DURBAN"
    assert rec["type"] == "Container Ship"
    assert rec["heading"] == 184  # HEADING unavailable (511) -> falls back to COURSE
    assert rec["status"] == "underway"
    assert rec["destinationPort"] == "DURBAN"
    assert rec["tsIso"] == "2026-07-09T14:15:30+00:00"
    assert rec["source"] == "marinetraffic"


def test_normalise_falls_back_to_ais_type_summary_when_type_name_missing():
    rec = MarineTrafficProvider.normalise({"MMSI": 1, "AIS_TYPE_SUMMARY": "Tanker"})
    assert rec["type"] == "Tanker"


def test_normalise_defaults_type_to_other_when_both_missing():
    rec = MarineTrafficProvider.normalise({"MMSI": 1})
    assert rec["type"] == "Other"


def test_normalise_falls_back_to_now_on_bad_timestamp():
    rec = MarineTrafficProvider.normalise({"MMSI": 1, "TIMESTAMP": "not-a-timestamp"})
    assert rec["tsIso"]  # non-empty ISO string, defaulted to ingest time


def test_normalise_handles_z_suffixed_timestamp():
    rec = MarineTrafficProvider.normalise({"MMSI": 1, "TIMESTAMP": "2026-07-09T14:15:30Z"})
    assert rec["tsIso"] == "2026-07-09T14:15:30+00:00"


def test_fetch_returns_empty_without_api_key(monkeypatch):
    monkeypatch.delenv("MARINETRAFFIC_API_KEY", raising=False)
    provider = MarineTrafficProvider(api_key="")
    assert provider.fetch({"latmin": -1, "latmax": 1, "lonmin": -1, "lonmax": 1}) == []


def test_fetch_swallows_error_envelope_response(monkeypatch):
    """MarineTraffic returns HTTP 200 with an {errors: [...]} body for most
    auth/quota failures — fetch() must treat that as empty, not crash trying
    to iterate a dict as if it were the vessel list."""
    import httpx

    class _FakeResponse:
        status_code = 200
        text = '{"errors": [{"code": 401, "detail": "Invalid API key"}]}'

        def json(self):
            return {"errors": [{"code": 401, "detail": "Invalid API key"}]}

    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse())
    provider = MarineTrafficProvider(api_key="bad-key")
    assert provider.fetch({"latmin": -1, "latmax": 1, "lonmin": -1, "lonmax": 1}) == []


def test_fetch_swallows_request_errors(monkeypatch):
    import httpx

    def _boom(*args, **kwargs):
        raise httpx.ConnectError("blocked")

    monkeypatch.setattr(httpx, "get", _boom)
    provider = MarineTrafficProvider(api_key="k")
    assert provider.fetch({"latmin": -1, "latmax": 1, "lonmin": -1, "lonmax": 1}) == []

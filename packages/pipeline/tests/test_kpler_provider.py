"""Unit tests for the Kpler AIS provider normaliser — no DB/network required.
Built against Kpler's real, verified AIS API v2 OpenAPI spec (supplied
directly by the account owner), unlike the MarineTraffic provider's tests
which pin behavior inferred from general public knowledge."""
from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))

from ingestors.providers.kpler import KplerAisProvider  # noqa: E402

# Exact example feature from the spec's LatestVesselPositionFeatureCollection schema.
SPEC_FEATURE = {
    "type": "Feature",
    "id": 6764564,
    "geometry": {"type": "Point", "coordinates": [-2.3567834, 58.7598532]},
    "geometry_name": "positionGeometry",
    "properties": {
        "vesselUid": 16,
        "mmsi": 987654321,
        "imo": 9128520,
        "longitude": -2.3567834,
        "latitude": 58.7598532,
        "sog": 10.2,
        "cog": 165,
        "rot": -16,
        "heading": 308,
        "navStatus": 0,
        "posMsgType": 21,
        "posSrc": "SAT",
        "vesselName": "AVEL VAD",
        "callsign": "FNALV",
        "flag": "FR",
        "vesselTypeAis": 70,
        "vesselType": "Bulk Carrier",
        "length": 67.3,
        "width": 12.42,
        "dwt": 45262,
        "grt": 62780,
        "destination": "Houston",
        "eta": "2025-12-01T12:00:00Z",
        "draught": 8.5,
        "staticMsgType": 21,
        "staticSrc": "SAT",
        "posDt": "2025-09-10T15:02:20Z",
        "staticDt": "2025-09-10T13:52:02Z",
        "insertDt": "2025-09-10T15:02:27Z",
    },
}


def test_normalise_maps_spec_example_feature():
    rec = KplerAisProvider.normalise(SPEC_FEATURE)
    assert rec["mmsi"] == "987654321"
    assert rec["imo"] == "9128520"
    assert rec["name"] == "AVEL VAD"
    assert rec["type"] == "Bulk Carrier"
    assert rec["lat"] == 58.7598532
    assert rec["lng"] == -2.3567834
    assert rec["speedKn"] == 10.2
    assert rec["heading"] == 308  # reported heading available, no COG fallback needed
    assert rec["status"] == "underway"
    assert rec["destinationPort"] == "Houston"
    assert rec["etaIso"] == "2025-12-01T12:00:00+00:00"
    assert rec["tsIso"] == "2025-09-10T15:02:20+00:00"
    assert rec["source"] == "kpler"


def test_normalise_falls_back_to_cog_when_heading_unavailable():
    props = dict(SPEC_FEATURE["properties"])
    props["heading"] = 511
    props["cog"] = 165
    rec = KplerAisProvider.normalise({"properties": props})
    assert rec["heading"] == 165


def test_normalise_defaults_type_to_other_when_missing():
    rec = KplerAisProvider.normalise({"properties": {"mmsi": 1}})
    assert rec["type"] == "Other"


def test_normalise_handles_missing_eta():
    rec = KplerAisProvider.normalise({"properties": {"mmsi": 1}})
    assert rec["etaIso"] == ""


def test_normalise_falls_back_to_now_when_posdt_missing():
    rec = KplerAisProvider.normalise({"properties": {"mmsi": 1}})
    assert rec["tsIso"]  # non-empty, defaulted to ingest time


def test_fetch_returns_empty_without_api_key(monkeypatch):
    monkeypatch.delenv("KPLER_API_KEY", raising=False)
    provider = KplerAisProvider(api_key="")
    assert provider.fetch({"latmin": -1, "latmax": 1, "lonmin": -1, "lonmax": 1}) == []


def test_fetch_sends_basic_literal_key_header_and_bbox_filter(monkeypatch):
    import httpx

    captured = {}

    class _FakeResponse:
        status_code = 200

        def json(self):
            return {"features": [SPEC_FEATURE]}

    def _fake_get(url, params=None, headers=None, timeout=None):
        captured["url"] = url
        captured["params"] = params
        captured["headers"] = headers
        return _FakeResponse()

    monkeypatch.setattr(httpx, "get", _fake_get)
    provider = KplerAisProvider(api_key="my-key")
    result = provider.fetch({"latmin": -35.0, "latmax": 15.0, "lonmin": -20.0, "lonmax": 52.0})
    assert result == [SPEC_FEATURE]
    assert captured["headers"] == {"Authorization": "Basic my-key"}
    assert captured["params"]["filter"] == "BBOX(position, -20.0, -35.0, 52.0, 15.0)"


def test_fetch_returns_empty_on_400(monkeypatch):
    import httpx

    class _FakeResponse:
        status_code = 400
        text = "Invalid ECQL filter"

    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse())
    provider = KplerAisProvider(api_key="bad-key")
    assert provider.fetch({"latmin": -1, "latmax": 1, "lonmin": -1, "lonmax": 1}) == []


def test_fetch_returns_empty_on_unexpected_shape(monkeypatch):
    import httpx

    class _FakeResponse:
        status_code = 200

        def json(self):
            return {"not": "a feature collection"}

    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse())
    provider = KplerAisProvider(api_key="k")
    assert provider.fetch({"latmin": -1, "latmax": 1, "lonmin": -1, "lonmax": 1}) == []


def test_fetch_swallows_request_errors(monkeypatch):
    import httpx

    def _boom(*args, **kwargs):
        raise httpx.ConnectError("blocked")

    monkeypatch.setattr(httpx, "get", _boom)
    provider = KplerAisProvider(api_key="k")
    assert provider.fetch({"latmin": -1, "latmax": 1, "lonmin": -1, "lonmax": 1}) == []

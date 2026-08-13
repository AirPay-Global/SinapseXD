"""Unit tests for the AISStream provider — no network required.

Payloads below are copied verbatim from AISStream's published documentation
(the AisStreamMessage and ShipStaticData examples), so these pin behaviour
against the real message shapes rather than against assumptions. Note
AISStream is in BETA and states its models are not stable — if the live
stream drifts, --probe is the tool that shows it.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))

from ingestors.providers.aisstream import (  # noqa: E402
    AisStreamProvider, _bbox_payload, _clean_text, _meta_of, _parse_eta, _parse_time,
)

# Verbatim from the docs' AisStreamMessage example.
DOC_POSITION_MSG = {
    "Message": {
        "PositionReport": {
            "Cog": 308, "CommunicationState": 81982, "Latitude": 66.02695,
            "Longitude": 12.253821666666665, "MessageID": 1,
            "NavigationalStatus": 15, "PositionAccuracy": True, "Raim": False,
            "RateOfTurn": 4, "RepeatIndicator": 0, "Sog": 0, "Spare": 0,
            "SpecialManoeuvreIndicator": 0, "Timestamp": 31, "TrueHeading": 235,
            "UserID": 259000420, "Valid": True,
        }
    },
    "MessageType": "PositionReport",
    "MetaData": {
        "MMSI": 259000420, "ShipName": "AUGUSTSON", "latitude": 66.02695,
        "longitude": 12.253821666666665,
        "time_utc": "2022-12-29 18:22:32.318353 +0000 UTC",
    },
}

# Verbatim from the docs' ShipStaticData example — note the '@' padding.
DOC_STATIC = {
    "AisVersion": 2, "CallSign": "LBHF", "Destination": "COASTGUARD@@@@@@@@H",
    "Dimension": {"A": 20, "B": 27, "C": 7, "D": 7}, "Dte": False,
    "Eta": {"Day": 0, "Hour": 0, "Minute": 0, "Month": 0}, "FixType": 1,
    "ImoNumber": 9353333, "MaximumStaticDraught": 4.5, "MessageID": 5,
    "Name": "KV FARM", "RepeatIndicator": 0, "Spare": False, "Type": 55,
    "UserID": 257069200, "Valid": True,
}


def test_bbox_is_latitude_first():
    """AISStream takes [lat, lon], the opposite of GeoJSON. Reversing this
    yields an empty stream rather than an error, so it is pinned."""
    payload = _bbox_payload({"latmin": -35.0, "latmax": 15.0, "lonmin": -20.0, "lonmax": 52.0})
    assert payload == [[[-35.0, -20.0], [15.0, 52.0]]]


def test_clean_text_strips_ais_at_padding():
    assert _clean_text("COASTGUARD@@@@@@@@H") == "COASTGUARDH"
    assert _clean_text("KV FARM") == "KV FARM"
    assert _clean_text(None) == ""


def test_meta_accepts_both_documented_spellings():
    """The docs use "MetaData" in the example and "Metadata" in the format
    description. Both must work."""
    assert _meta_of({"MetaData": {"MMSI": 1}}) == {"MMSI": 1}
    assert _meta_of({"Metadata": {"MMSI": 2}}) == {"MMSI": 2}
    assert _meta_of({}) == {}


def test_normalise_maps_documented_position_and_static():
    rec = AisStreamProvider.normalise({
        "mmsi": "259000420",
        "meta": DOC_POSITION_MSG["MetaData"],
        "position": DOC_POSITION_MSG["Message"]["PositionReport"],
        "static": DOC_STATIC,
    })
    assert rec["mmsi"] == "259000420"
    assert rec["imo"] == "9353333"
    assert rec["name"] == "KV FARM"
    assert rec["type"] == "Law enforcement"       # AIS type 55
    assert rec["lat"] == 66.02695
    assert rec["lng"] == 12.253821666666665
    assert rec["speedKn"] == 0.0
    assert rec["heading"] == 235
    assert rec["status"] == "underway"            # NavigationalStatus 15 -> default
    assert rec["destinationPort"] == "COASTGUARDH"  # '@' padding stripped
    assert rec["etaIso"] == ""                    # all-zero Eta = not available
    assert rec["tsIso"].startswith("2022-12-29T18:22:32")
    assert rec["source"] == "aisstream"


def test_normalise_without_static_still_yields_a_position():
    """ShipStaticData is broadcast far less often than PositionReport, so a
    vessel seen only once in a collection window must still produce a usable
    record rather than being dropped."""
    rec = AisStreamProvider.normalise({
        "mmsi": "259000420",
        "meta": DOC_POSITION_MSG["MetaData"],
        "position": DOC_POSITION_MSG["Message"]["PositionReport"],
    })
    assert rec["lat"] == 66.02695
    assert rec["name"] == "AUGUSTSON"   # falls back to MetaData.ShipName
    assert rec["imo"] == ""
    assert rec["type"] == "Other"


def test_true_heading_511_falls_back_to_course():
    pos = dict(DOC_POSITION_MSG["Message"]["PositionReport"])
    pos["TrueHeading"] = 511      # ITU-R "not available"
    pos["Cog"] = 308
    rec = AisStreamProvider.normalise({"mmsi": "1", "meta": {}, "position": pos})
    assert rec["heading"] == 308


def test_parse_time_handles_go_format():
    """MetaData.time_utc is a Go time.String(), not ISO-8601."""
    assert _parse_time("2022-12-29 18:22:32.318353 +0000 UTC").startswith("2022-12-29T18:22:32")


def test_parse_time_falls_back_to_now_when_unparseable():
    assert _parse_time("gibberish")  # non-empty ISO string, defaulted to ingest time


def test_parse_eta_rejects_the_all_zero_not_available_encoding():
    assert _parse_eta({"Month": 0, "Day": 0, "Hour": 0, "Minute": 0}) == ""
    assert _parse_eta(None) == ""


def test_parse_eta_builds_iso_from_month_day_hour_minute():
    from datetime import datetime, timezone
    now = datetime(2026, 8, 13, tzinfo=timezone.utc)
    assert _parse_eta({"Month": 8, "Day": 20, "Hour": 14, "Minute": 30}, now=now) == \
        "2026-08-20T14:30:00+00:00"


def test_fetch_returns_empty_without_api_key(monkeypatch):
    monkeypatch.delenv("AISSTREAM_API_KEY", raising=False)
    provider = AisStreamProvider(api_key="")
    assert provider.fetch({"latmin": -1, "latmax": 1, "lonmin": -1, "lonmax": 1}) == []


def test_invalid_api_key_error_message_is_surfaced_not_skipped(caplog):
    """AISStream reports a bad key as an ordinary message,
    {"error": "Api Key Is Not Valid"}. Skipping it would make a bad key
    indistinguishable from an empty ocean."""
    class _FakeWS:
        def settimeout(self, _): pass
        def recv(self): return json.dumps({"error": "Api Key Is Not Valid"})

    provider = AisStreamProvider(api_key="bad", collect_seconds=5)
    with caplog.at_level("ERROR"):
        assert provider._collect(_FakeWS()) == []
    assert "REJECTED THE SUBSCRIPTION" in caplog.text
    assert "Api Key Is Not Valid" in caplog.text


def test_collect_merges_position_and_static_per_mmsi():
    """The two message types carry disjoint fields for the same vessel and
    arrive separately; only merged do they make a complete record."""
    static_msg = {
        "MessageType": "ShipStaticData",
        "MetaData": {"MMSI": 259000420, "ShipName": "AUGUSTSON",
                     "time_utc": "2022-12-29 18:22:32.318353 +0000 UTC"},
        "Message": {"ShipStaticData": DOC_STATIC},
    }
    msgs = [json.dumps(DOC_POSITION_MSG), json.dumps(static_msg)]

    class _FakeWS:
        def __init__(self): self.i = 0
        def settimeout(self, _): pass
        def recv(self):
            if self.i >= len(msgs):
                raise TimeoutError("window over")
            self.i += 1
            return msgs[self.i - 1]

    provider = AisStreamProvider(api_key="k", collect_seconds=5)
    records = provider._collect(_FakeWS())
    assert len(records) == 1
    rec = AisStreamProvider.normalise(records[0])
    assert rec["lat"] == 66.02695           # from PositionReport
    assert rec["imo"] == "9353333"          # from ShipStaticData
    assert rec["destinationPort"] == "COASTGUARDH"


def test_collect_drops_vessels_seen_only_as_static_with_no_position():
    static_only = {
        "MessageType": "ShipStaticData",
        "MetaData": {"MMSI": 111111111, "ShipName": "NO POSITION"},
        "Message": {"ShipStaticData": DOC_STATIC},
    }

    class _FakeWS:
        def __init__(self): self.sent = False
        def settimeout(self, _): pass
        def recv(self):
            if self.sent:
                raise TimeoutError("window over")
            self.sent = True
            return json.dumps(static_only)

    provider = AisStreamProvider(api_key="k", collect_seconds=5)
    assert provider._collect(_FakeWS()) == []

"""AISHub provider — free community AIS feed for dev/testing.

AISHub is a reciprocal network: an API username is issued only once you feed
your own AIS receiver data into it, and terrestrial coverage is sparse in
African waters. So this is the DEV feed — Spire (satellite) remains the
production source. Same normalised output either way.

API shape (confirm against https://www.aishub.net/api when a key is issued):
  GET https://data.aishub.net/ws.php
    username=<AISHUB_USERNAME>   required
    format=1                     1 = human-readable (0 = encoded integers)
    output=json                  json | xml | csv
    latmin/latmax/lonmin/lonmax  bounding box
    interval=<minutes>           only vessels with data newer than N minutes
  Rate limit: 1 request / minute minimum.
  Response: [ {ERROR, USERNAME, RECORDS, ...}, [ {vessel}, ... ] ]
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

WS_URL = "https://data.aishub.net/ws.php"

# AIS navigational status (NAVSTAT 0–15) → VesselStatus.
# Note: "expected" and "delayed" are scheduling-derived, not present in raw
# AIS; only "aground" gives a usable disruption signal here.
_NAVSTAT_TO_STATUS: dict[int, str] = {
    0: "underway",   # under way using engine
    1: "at_anchor",
    2: "underway",   # not under command
    3: "underway",   # restricted manoeuvrability
    4: "underway",   # constrained by draught
    5: "moored",
    6: "delayed",    # aground
    7: "underway",   # engaged in fishing
    8: "underway",   # under way sailing
}

# AIS ship-type code (0–99) → coarse label. AIS can't distinguish e.g.
# container vs general cargo, so dev labels are coarser than the demo data.
def _ship_type_label(code: int) -> str:
    if 60 <= code <= 69:
        return "Passenger"
    if 70 <= code <= 79:
        return "Cargo"
    if 80 <= code <= 89:
        return "Tanker"
    if 40 <= code <= 49:
        return "High-speed craft"
    if code == 30:
        return "Fishing"
    if code in (31, 32, 52):
        return "Tug"
    if code == 36:
        return "Sailing"
    if code == 37:
        return "Pleasure craft"
    return "Other"


def _to_int(value: object, default: int = 0) -> int:
    try:
        return int(float(value))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _to_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _heading(raw: dict) -> int:
    # AIS HEADING 511 = "not available"; fall back to course over ground.
    hdg = _to_int(raw.get("HEADING"), 511)
    if hdg == 511:
        cog = _to_int(raw.get("COG"), 360)
        return 0 if cog >= 360 else cog % 360
    return hdg % 360


def _parse_eta(raw: object, now: datetime | None = None) -> str:
    """AIS ETA carries month/day/hour/minute but no year. Infer the year and
    return an ISO-8601 UTC string, or "" when unparseable/blank."""
    if not raw:
        return ""
    now = now or datetime.now(timezone.utc)
    text = str(raw).strip()
    digits = [int(t) for t in _split_digits(text)]
    if len(digits) < 4:
        return ""
    month, day, hour, minute = digits[0], digits[1], digits[2], digits[3]
    if not (1 <= month <= 12 and 1 <= day <= 31 and hour <= 23 and minute <= 59):
        return ""
    year = now.year
    try:
        eta = datetime(year, month, day, hour, minute, tzinfo=timezone.utc)
    except ValueError:
        return ""
    # ETA in the past by more than a month → it's for next year.
    if (now - eta).days > 31:
        try:
            eta = eta.replace(year=year + 1)
        except ValueError:
            return ""
    return eta.isoformat()


def _split_digits(text: str) -> list[str]:
    out, cur = [], ""
    for ch in text:
        if ch.isdigit():
            cur += ch
        elif cur:
            out.append(cur)
            cur = ""
    if cur:
        out.append(cur)
    return out


class AISHubProvider:
    queue_name = "ais.vessel.positions"

    def __init__(self, username: str | None = None, *, timeout: float = 20.0):
        self.username = username or os.environ.get("AISHUB_USERNAME", "")
        self.timeout = timeout

    def fetch(self, bbox: dict[str, float]) -> list[dict]:
        if not self.username:
            logger.warning("AISHUB_USERNAME not set; AIS ingestor idle (dashboards use demo data)")
            return []
        params = {
            "username": self.username,
            "format": 1,
            "output": "json",
            "latmin": bbox["latmin"],
            "latmax": bbox["latmax"],
            "lonmin": bbox["lonmin"],
            "lonmax": bbox["lonmax"],
        }
        resp = httpx.get(WS_URL, params=params, timeout=self.timeout)
        resp.raise_for_status()
        payload = resp.json()
        if not isinstance(payload, list) or len(payload) < 2:
            logger.error("AISHub: unexpected response envelope: %r", payload)
            return []
        meta, vessels = payload[0], payload[1]
        if isinstance(meta, dict) and meta.get("ERROR"):
            logger.error("AISHub error: %s", meta.get("ERROR_MESSAGE", meta))
            return []
        return vessels if isinstance(vessels, list) else []

    @staticmethod
    def normalise(raw: dict) -> dict:
        navstat = _to_int(raw.get("NAVSTAT"), 15)
        return {
            "mmsi": str(raw.get("MMSI", "")).strip(),
            "imo": str(raw.get("IMO", "") or "").strip(),
            "name": str(raw.get("NAME", "") or "").strip(),
            "type": _ship_type_label(_to_int(raw.get("TYPE"))),
            "lat": _to_float(raw.get("LATITUDE")),
            "lng": _to_float(raw.get("LONGITUDE")),
            "speedKn": _to_float(raw.get("SOG")),
            "heading": _heading(raw),
            "status": _NAVSTAT_TO_STATUS.get(navstat, "underway"),
            "destinationPort": str(raw.get("DEST", "") or "").strip(),
            "etaIso": _parse_eta(raw.get("ETA")),
        }

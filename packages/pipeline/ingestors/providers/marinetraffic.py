"""MarineTraffic provider — commercial AIS feed, the recommended production
source for African coverage per API_REGISTRATIONS.md (better terrestrial +
satellite density than AISHub's community network, which is dev-only).

IMPORTANT — build provenance: this module was written from MarineTraffic's
long-standing, publicly documented PS01 "Vessel Positions" service
convention, NOT verified against a live fetch of servicedocs.marinetraffic.com
— that host is blocked by this environment's network egress policy. Field
names below match MarineTraffic's stable, widely-integrated extended-position
response shape, but you MUST confirm them against your own account's API
Playground (Settings → API Services in the MarineTraffic dashboard) before
relying on this in production — that page reflects your specific plan and
subscribed service, and MarineTraffic occasionally version-gates fields
(v:5 vs v:8; simple vs extended message type) per subscription tier.

API shape (confirm against your account's PS01 docs when a key is issued):
  GET https://services.marinetraffic.com/api/exportvessels/v:8/{API_KEY}
    protocol=jsonp|json|xml|csv    we use json
    msgtype=extended               required for SHIPNAME/DESTINATION/ETA etc.
    timespan=<minutes>              only vessels reporting within N minutes
    minlat/maxlat/minlon/maxlon     bounding box (degrees)
  The API key is embedded as a URL path segment (not a query param) —
  unusual but consistent across MarineTraffic's whole API family.
  Response: JSON array of vessel objects (msgtype=extended), or an error
  object {errors: [...]} on failure — MarineTraffic returns HTTP 200 with an
  error body rather than a 4xx for most auth/quota failures, so the body
  must be inspected even on a 200.
  Rate limit: plan-dependent (typically hourly call-count quota, not a
  per-second limit like AISHub) — poll interval should stay configurable.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://services.marinetraffic.com/api/exportvessels/v:8"

# Same AIS navigational-status vocabulary as AISHub (NAVSTAT 0-15 is a
# standard ITU-R AIS field, not MarineTraffic-specific) — kept as a local
# copy rather than importing from aishub.py so each provider module stays
# independently readable, matching this repo's existing provider convention.
_STATUS_TO_VESSEL_STATUS: dict[int, str] = {
    0: "underway", 1: "at_anchor", 2: "underway", 3: "underway",
    4: "underway", 5: "moored", 6: "delayed", 7: "underway", 8: "underway",
}


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


def _ship_type_label(type_name: object, ais_type_summary: object) -> str:
    # MarineTraffic's extended response includes a human-readable type
    # already (TYPE_NAME / AIS_TYPE_SUMMARY) — prefer that over decoding a
    # numeric code ourselves, unlike AISHub which only gives a raw code.
    label = str(type_name or ais_type_summary or "").strip()
    return label or "Other"


def _heading(raw: dict) -> int:
    hdg = _to_int(raw.get("HEADING"), 511)
    if hdg == 511:
        cog = _to_float(raw.get("COURSE"), 360.0)
        return 0 if cog >= 360 else int(cog) % 360
    return hdg % 360


def _parse_eta(raw: object, now: datetime | None = None) -> str:
    """MarineTraffic ETA is documented as "MM-DD HH:MM" UTC, no year (same
    year-inference problem as raw AIS ETA — see aishub.py's identical
    helper). Returns ISO-8601 UTC or "" when unparseable/blank."""
    if not raw:
        return ""
    now = now or datetime.now(timezone.utc)
    text = str(raw).strip()
    digits = []
    cur = ""
    for ch in text:
        if ch.isdigit():
            cur += ch
        elif cur:
            digits.append(int(cur))
            cur = ""
    if cur:
        digits.append(int(cur))
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
    if (now - eta).days > 31:
        try:
            eta = eta.replace(year=year + 1)
        except ValueError:
            return ""
    return eta.isoformat()


def _parse_time(raw: object, now: datetime | None = None) -> str:
    """MarineTraffic's TIMESTAMP field is already ISO-8601 UTC
    ("YYYY-MM-DDTHH:MM:SS") in the v:8 extended response — unlike AISHub's
    compact "YYYYMMDDHHMMSS". Falls back to ingest time when absent/
    unparseable so every record still gets a partition key."""
    now = now or datetime.now(timezone.utc)
    text = str(raw or "").strip()
    if text:
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.isoformat()
        except ValueError:
            pass
    return now.isoformat()


class MarineTrafficProvider:
    queue_name = "ais.vessel.positions"

    def __init__(self, api_key: str | None = None, *, timeout: float = 20.0):
        self.api_key = api_key or os.environ.get("MARINETRAFFIC_API_KEY", "")
        self.timeout = timeout

    def fetch(self, bbox: dict[str, float]) -> list[dict]:
        if not self.api_key:
            logger.warning("MARINETRAFFIC_API_KEY not set; AIS ingestor idle (dashboards use demo data)")
            return []
        url = f"{BASE_URL}/{self.api_key}"
        params = {
            "protocol": "json",
            "msgtype": "extended",
            "timespan": int(os.environ.get("MARINETRAFFIC_TIMESPAN_MINUTES", "10")),
            "minlat": bbox["latmin"],
            "maxlat": bbox["latmax"],
            "minlon": bbox["lonmin"],
            "maxlon": bbox["lonmax"],
        }
        try:
            resp = httpx.get(url, params=params, timeout=self.timeout)
        except Exception:
            logger.exception("MarineTraffic fetch failed")
            return []
        # MarineTraffic returns HTTP 200 with an error body for most
        # auth/quota failures, so a clean status code alone doesn't mean a
        # clean payload — inspect the body regardless.
        if resp.status_code >= 400:
            logger.error("MarineTraffic HTTP %s: %s", resp.status_code, resp.text[:500])
            return []
        try:
            payload = resp.json()
        except Exception:
            logger.error("MarineTraffic: non-JSON response: %s", resp.text[:500])
            return []
        if isinstance(payload, dict):
            # Error envelope shape, e.g. {"errors": [{"code": ..., "detail": ...}]}
            logger.error("MarineTraffic error response: %r", payload)
            return []
        if not isinstance(payload, list):
            logger.error("MarineTraffic: unexpected response shape: %r", type(payload))
            return []
        return payload

    @staticmethod
    def normalise(raw: dict) -> dict:
        status = _to_int(raw.get("STATUS"), 15)
        return {
            "mmsi": str(raw.get("MMSI", "")).strip(),
            "imo": str(raw.get("IMO", "") or "").strip(),
            "name": str(raw.get("SHIPNAME", "") or "").strip(),
            "type": _ship_type_label(raw.get("TYPE_NAME"), raw.get("AIS_TYPE_SUMMARY")),
            "lat": _to_float(raw.get("LAT")),
            "lng": _to_float(raw.get("LON")),
            "speedKn": _to_float(raw.get("SPEED")),
            "heading": _heading(raw),
            "status": _STATUS_TO_VESSEL_STATUS.get(status, "underway"),
            "destinationPort": str(raw.get("DESTINATION", "") or "").strip(),
            "etaIso": _parse_eta(raw.get("ETA")),
            "tsIso": _parse_time(raw.get("TIMESTAMP")),
            "source": "marinetraffic",
        }

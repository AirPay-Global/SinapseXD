"""Kpler AIS provider — built and verified against the real Kpler AIS API v2
OpenAPI specification (supplied directly by the account owner), unlike the
MarineTraffic provider which had to be built from general public knowledge
because its docs host is blocked by this environment's network egress.
Every field name, endpoint path, auth header format, and response shape
below is taken straight from that spec.

API shape (Kpler AIS API v2):
  GET https://api.kpler.com/v2/maritime/ais-latest
    filter=<ECQL>      Extended CQL — logical/comparison/spatial operators.
                        Spatial bounding box: BBOX(position, minLon, minLat, maxLon, maxLat)
    format=json         GeoJSON FeatureCollection (default). csv also supported, unused here.
    limit=<int>          up to 1,000,000
    fields=<csv>          not used — we take the full property set
  Auth: header "Authorization: Basic {{API_KEY}}" — this is Kpler's literal,
  non-standard convention: the raw key value follows "Basic " directly, NOT
  a base64-encoded "user:pass" pair despite reusing the RFC 7617 keyword.
  Response: GeoJSON FeatureCollection. Each feature's properties carry mmsi,
  imo, vesselName, vesselType, longitude, latitude, sog, cog, heading,
  navStatus, destination, eta (ISO-8601), posDt (ISO-8601, position
  timestamp) — see LatestVesselPositionProperties in the spec.
  Returns HTTP 400 (not 200-with-error-body) for invalid params/filters, so
  ordinary status-code handling is correct here — no MarineTraffic-style
  200-with-errors quirk to work around.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.kpler.com/v2/maritime/ais-latest"

# Standard ITU-R AIS navStatus 0-15 vocabulary, kept as a local copy per this
# repo's existing provider convention (see marinetraffic.py).
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


def _heading(props: dict) -> int:
    # heading is AIS-reported true heading; 511 means "not available" per
    # ITU-R AIS convention (same fallback rule as the other providers).
    hdg = _to_int(props.get("heading"), 511)
    if hdg == 511:
        cog = _to_float(props.get("cog"), 360.0)
        return 0 if cog >= 360 else int(cog) % 360
    return hdg % 360


def _parse_iso(raw: object, now: datetime | None = None) -> str:
    """Kpler's eta/posDt fields are already ISO-8601 UTC (e.g.
    "2025-09-10T15:02:20Z") — no MM-DD-only year-inference needed, unlike
    AISHub/MarineTraffic's ETA fields."""
    text = str(raw or "").strip()
    if text:
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.isoformat()
        except ValueError:
            pass
    return ""


def _parse_pos_time(raw: object, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    parsed = _parse_iso(raw)
    return parsed or now.isoformat()


class KplerAisProvider:
    queue_name = "ais.vessel.positions"

    def __init__(self, api_key: str | None = None, *, timeout: float = 20.0):
        self.api_key = api_key or os.environ.get("KPLER_API_KEY", "")
        self.timeout = timeout

    def fetch(self, bbox: dict[str, float]) -> list[dict]:
        if not self.api_key:
            logger.warning("KPLER_API_KEY not set; AIS ingestor idle (dashboards use demo data)")
            return []
        ecql_bbox = (
            f"BBOX(position, {bbox['lonmin']}, {bbox['latmin']}, "
            f"{bbox['lonmax']}, {bbox['latmax']})"
        )
        params = {
            "filter": ecql_bbox,
            "format": "json",
            "limit": int(os.environ.get("KPLER_LIMIT", "5000")),
        }
        headers = {"Authorization": f"Basic {self.api_key}"}
        try:
            resp = httpx.get(BASE_URL, params=params, headers=headers, timeout=self.timeout)
        except Exception:
            logger.exception("Kpler fetch failed")
            return []
        if resp.status_code >= 400:
            logger.error("Kpler HTTP %s: %s", resp.status_code, resp.text[:500])
            return []
        try:
            payload = resp.json()
        except Exception:
            logger.error("Kpler: non-JSON response: %s", resp.text[:500])
            return []
        if not isinstance(payload, dict) or not isinstance(payload.get("features"), list):
            logger.error("Kpler: unexpected response shape: %r", type(payload))
            return []
        return payload["features"]

    @staticmethod
    def normalise(raw: dict) -> dict:
        props = raw.get("properties", {}) if isinstance(raw, dict) else {}
        status = _to_int(props.get("navStatus"), 15)
        return {
            "mmsi": str(props.get("mmsi", "") or "").strip(),
            "imo": str(props.get("imo", "") or "").strip(),
            "name": str(props.get("vesselName", "") or "").strip(),
            "type": str(props.get("vesselType", "") or "").strip() or "Other",
            "lat": _to_float(props.get("latitude")),
            "lng": _to_float(props.get("longitude")),
            "speedKn": _to_float(props.get("sog")),
            "heading": _heading(props),
            "status": _STATUS_TO_VESSEL_STATUS.get(status, "underway"),
            "destinationPort": str(props.get("destination", "") or "").strip(),
            "etaIso": _parse_iso(props.get("eta")),
            "tsIso": _parse_pos_time(props.get("posDt")),
            "source": "kpler",
        }

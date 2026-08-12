"""Kpler AIS provider — built and verified against the real Kpler AIS API v2
OpenAPI specification (supplied directly by the account owner), unlike the
MarineTraffic provider which had to be built from general public knowledge
because its docs host is blocked by this environment's network egress.
Every field name, endpoint path, auth header format, and response shape
below is taken straight from that spec.

API shape (Kpler AIS API v2) — two datasets, same auth/response shape:

  AIS – Latest: GET https://api.kpler.com/v2/maritime/ais-latest
    One most-recent position per vessel (last 7 days). Feeds the continuous
    ais_ingestor poll loop (fetch(), below) — this is the live vessel map.
    filter=<ECQL>      Extended CQL — logical/comparison/spatial operators.
                        Spatial bounding box: BBOX(position, minLon, minLat, maxLon, maxLat)
    format=json         GeoJSON FeatureCollection (default). csv also supported, unused here.
    limit=<int>          up to 1,000,000

  AIS – Historical: GET https://api.kpler.com/v2/maritime/ais-historical
    Multiple positions per vessel over a time window — full trail or
    downsampled. Not a fit for the continuous BullMQ poll loop (it's a
    windowed query, not a "what's new since last poll" feed), so it's
    exposed as an on-demand method (fetch_historical(), below) for
    corridor/transit-time analysis, congestion marts, etc. Every request
    MUST include a posDt time range (ECQL BETWEEN) plus either a vessel
    scope (vesselUid/mmsi, max 10 vessels, max 366-day range) or a
    geographic scope (bbox/polygon, max 55,000 km², max 1-day range —
    widens to 1,000,000 km² only when downsample=hourly). Data available
    back to 2015-01-01; trial accounts limited to the most recent 30 days.
    downsample=dynamic|hourly|none (default dynamic: >=1 position per 10min,
    plus turn-rate/speed-change spikes; hourly: 1 position per vessel/hour).

  Auth (both endpoints): header "Authorization: Basic {{API_KEY}}" — this is
  Kpler's literal, non-standard convention: the raw key value follows
  "Basic " directly, NOT a base64-encoded "user:pass" pair despite reusing
  the RFC 7617 keyword.
  Response (both): GeoJSON FeatureCollection. Each feature's properties
  carry mmsi, imo, vesselName, vesselType, longitude, latitude, sog, cog,
  heading, navStatus, destination, eta (ISO-8601), posDt (ISO-8601,
  position timestamp) — see LatestVesselPositionProperties in the spec.
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

LATEST_URL = "https://api.kpler.com/v2/maritime/ais-latest"
HISTORICAL_URL = "https://api.kpler.com/v2/maritime/ais-historical"
BASE_URL = LATEST_URL  # kept for backwards compatibility with existing references

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


def _bbox_filter(bbox: dict[str, float]) -> str:
    return (
        f"BBOX(position, {bbox['lonmin']}, {bbox['latmin']}, "
        f"{bbox['lonmax']}, {bbox['latmax']})"
    )


class KplerAisProvider:
    queue_name = "ais.vessel.positions"

    def __init__(self, api_key: str | None = None, *, timeout: float = 20.0):
        self.api_key = api_key or os.environ.get("KPLER_API_KEY", "")
        self.timeout = timeout

    def fetch(self, bbox: dict[str, float]) -> list[dict]:
        if not self.api_key:
            logger.warning("KPLER_API_KEY not set; AIS ingestor idle (dashboards use demo data)")
            return []
        ecql_bbox = _bbox_filter(bbox)
        params = {
            "filter": ecql_bbox,
            "format": "json",
            "limit": int(os.environ.get("KPLER_LIMIT", "5000")),
        }
        return self._get(LATEST_URL, params, log_label="Kpler")

    def fetch_historical(
        self,
        *,
        start_iso: str,
        end_iso: str,
        bbox: dict[str, float] | None = None,
        vessel_uids: list[int] | None = None,
        mmsis: list[str] | None = None,
        downsample: str = "dynamic",
        limit: int | None = None,
    ) -> list[dict]:
        """On-demand windowed query — NOT part of the continuous poll loop.
        Every call must include a posDt range plus either a vessel scope
        (vessel_uids/mmsis) or a geographic scope (bbox), per the API's
        own validation (see module docstring for the exact limits)."""
        if not self.api_key:
            logger.warning("KPLER_API_KEY not set; AIS historical query skipped")
            return []
        if not vessel_uids and not mmsis and not bbox:
            raise ValueError("fetch_historical requires vessel_uids/mmsis or bbox")
        clauses = [f"posDt BETWEEN '{start_iso}' AND '{end_iso}'"]
        scope_clauses = []
        if vessel_uids:
            ids = ",".join(str(v) for v in vessel_uids)
            scope_clauses.append(f"vesselUid IN ({ids})")
        if mmsis:
            ids = ",".join(f"'{m}'" for m in mmsis)
            scope_clauses.append(f"mmsi IN ({ids})")
        if bbox:
            scope_clauses.append(_bbox_filter(bbox))
        if scope_clauses:
            clauses.append("(" + " OR ".join(scope_clauses) + ")")
        params = {
            "filter": " AND ".join(clauses),
            "format": "json",
            "downsample": downsample,
            "limit": limit if limit is not None else int(os.environ.get("KPLER_HISTORICAL_LIMIT", "50000")),
        }
        return self._get(HISTORICAL_URL, params, log_label="Kpler historical")

    def _get(self, url: str, params: dict, *, log_label: str) -> list[dict]:
        headers = {"Authorization": f"Basic {self.api_key}"}
        try:
            resp = httpx.get(url, params=params, headers=headers, timeout=self.timeout)
        except Exception:
            logger.exception("%s fetch failed", log_label)
            return []
        if resp.status_code in (401, 403):
            # Called out separately from other 4xx because an auth failure is
            # an operator problem, not a transient one: it will not recover on
            # the next poll, and the empty list it degrades to is otherwise
            # indistinguishable from "no vessels in this bbox" — which is
            # exactly how a rejected key stayed invisible in production.
            logger.error(
                "%s: Kpler REJECTED THE API KEY (HTTP %s). This will not fix itself on "
                "retry. The 'Basic <key>' header format is correct per Kpler's own "
                "OpenAPI spec, so a persistent 401/403 means the key is invalid, "
                "inactive, or not entitled to the AIS product — Kpler licenses AIS "
                "separately from its cargo/trade products. Confirm with Kpler that "
                "this key covers the AIS API. Body: %s",
                log_label, resp.status_code, resp.text[:300],
            )
            return []
        if resp.status_code >= 400:
            logger.error("%s HTTP %s: %s", log_label, resp.status_code, resp.text[:500])
            return []
        try:
            payload = resp.json()
        except Exception:
            logger.error("%s: non-JSON response: %s", log_label, resp.text[:500])
            return []
        if not isinstance(payload, dict) or not isinstance(payload.get("features"), list):
            logger.error("%s: unexpected response shape: %r", log_label, type(payload))
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

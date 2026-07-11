"""Freightos Baltic Index (FBX) provider — free-tier container freight
benchmarks. Free registration required (unlike World Bank/Open-Meteo), so
this follows the AISHub/Comtrade idle-by-default pattern rather than being
always-on.

Scope, honestly: FBX's public indices are major global East-West lanes
(Asia–N.Europe, Asia–US, etc.) — there is no African-corridor-specific FBX
index. So this pillar contributes global container-market benchmark context
("is ocean freight generally expensive right now"), not a port-specific
rate. Dashboards must label it as a macro benchmark, not a corridor rate.

API shape (per https://fbx.freightos.com/api/ — free tier, registration
required for an API key):
  GET https://fbx.freightos.com/api/v1/index
    ?index=<code>          e.g. FBX01 (global container index)
    Header: apikey: <FREIGHTOS_API_KEY>
  Response: { index: <code>, values: [ {date, value}, ... ] }
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://fbx.freightos.com/api/v1/index"

# FBX index code → our freight_rates.route label. FBX01 is the global
# composite container index — the one series broad enough to be a fair
# macro benchmark rather than implying false African-lane specificity.
INDICES: dict[str, str] = {
    "FBX01": "global-container-composite",
}


def _num(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


class FreightosProvider:
    queue_name = "market.freight.rates"

    def __init__(self, api_key: str | None = None, *, indices: dict[str, str] | None = None, timeout: float = 20.0):
        self.api_key = api_key or os.environ.get("FREIGHTOS_API_KEY", "")
        self.indices = indices or INDICES
        self.timeout = timeout

    def fetch(self) -> list[dict]:
        if not self.api_key:
            logger.warning("FREIGHTOS_API_KEY not set; market ingestor idle (dashboards use demo data)")
            return []
        rows: list[dict] = []
        headers = {"apikey": self.api_key}
        for code, route in self.indices.items():
            try:
                resp = httpx.get(BASE_URL, params={"index": code}, headers=headers, timeout=self.timeout)
                resp.raise_for_status()
                payload = resp.json()
            except Exception:
                logger.exception("Freightos fetch failed for index %s", code)
                continue
            for point in payload.get("values", []) or []:
                point["_route"] = route
                rows.append(point)
        logger.info("Freightos: fetched %d index readings", len(rows))
        return rows

    @staticmethod
    def normalise(raw: dict) -> dict:
        return {
            "route": raw.get("_route", ""),
            "rateUsd": _num(raw.get("value")),
            "dateIso": raw.get("date", ""),
            "indexSource": "freightos",
        }

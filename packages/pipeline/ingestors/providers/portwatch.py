"""IMF PortWatch provider — daily port activity & trade estimates.

PortWatch (portwatch.imf.org) is an open IMF dataset built from UN Global
Platform AIS data: daily port calls and import/export volume estimates for
~1,600 ports worldwide, including African ports. No API key, no reciprocal
feed — unlike AISHub — which makes it the better regional source for the
Port dashboard's port-call and throughput cards.

Served as an Esri ArcGIS FeatureServer. Query API:
  GET <FeatureServer>/0/query
    where=<SQL>            row filter, e.g. "ISO3='ZAF' AND year=2026"
    outFields=*
    f=json
    resultOffset / resultRecordCount   pagination (server caps a page at ~2000)
  A page response sets "exceededTransferLimit": true when more rows remain.

Scope the `where` clause in production — the full history (daily since 2019
across 1,600 ports) is millions of rows. Default filters to African ISO3s.
"""
from __future__ import annotations

import logging
import os

import httpx

from ontology import resolve_port

logger = logging.getLogger(__name__)

DEFAULT_URL = (
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/"
    "Daily_Ports_Data/FeatureServer/0/query"
)
PAGE_SIZE = 2000
MAX_PAGES = 500  # safety cap against a mis-scoped where clause

# ArcGIS attribute suffix → our VesselClass key.
_CLASS_FIELDS: dict[str, str] = {
    "container": "container",
    "dry_bulk": "dryBulk",
    "general_cargo": "generalCargo",
    "roro": "roro",
    "tanker": "tanker",
}


def _num(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def _date_iso(attrs: dict) -> str:
    raw = attrs.get("date")
    if isinstance(raw, str) and len(raw) >= 10:
        return raw[:10]
    y, m, d = attrs.get("year"), attrs.get("month"), attrs.get("day")
    if y and m and d:
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    return ""


class PortWatchProvider:
    queue_name = "port.activity.daily"

    def __init__(
        self,
        *,
        url: str | None = None,
        where: str | None = None,
        timeout: float = 30.0,
    ):
        self.url = url or os.environ.get("PORTWATCH_FEATURESERVER_URL", DEFAULT_URL)
        # Default scope: African coastal states. Override with PORTWATCH_WHERE.
        self.where = where or os.environ.get(
            "PORTWATCH_WHERE",
            "ISO3 IN ('ZAF','KEN','NGA','TGO','DJI','TZA','GHA')",
        )
        self.timeout = timeout

    def fetch(self, _bbox: dict | None = None) -> list[dict]:
        rows: list[dict] = []
        for page in range(MAX_PAGES):
            params = {
                "where": self.where,
                "outFields": "*",
                "outSR": 4326,
                "f": "json",
                "resultOffset": page * PAGE_SIZE,
                "resultRecordCount": PAGE_SIZE,
            }
            resp = httpx.get(self.url, params=params, timeout=self.timeout)
            resp.raise_for_status()
            payload = resp.json()
            if "error" in payload:
                logger.error("PortWatch query error: %s", payload["error"])
                break
            features = payload.get("features", [])
            rows.extend(f.get("attributes", {}) for f in features)
            if not payload.get("exceededTransferLimit") or not features:
                break
        else:
            logger.warning("PortWatch: hit MAX_PAGES (%d) — widen the where filter", MAX_PAGES)
        logger.info("PortWatch: fetched %d daily port records", len(rows))
        return rows

    @staticmethod
    def normalise(raw: dict) -> dict:
        def by_class(prefix: str) -> dict[str, float]:
            return {
                cls: _num(raw.get(f"{prefix}_{field}"))
                for field, cls in _CLASS_FIELDS.items()
            }

        iso3 = str(raw.get("ISO3", "")).strip()
        port_name = str(raw.get("portname", "")).strip()
        native_port = str(raw.get("portid", "")).strip()
        canonical_port = resolve_port(
            "portwatch", native_id=native_port, name=port_name, iso3=iso3
        )
        return {
            "portId": native_port,
            # Canonical ontology key; None when the port isn't yet in the
            # registry (logged upstream so the crosswalk can be extended).
            "canonicalPortId": canonical_port,
            "portName": port_name,
            "country": str(raw.get("country", "")).strip(),
            "iso3": iso3,
            "dateIso": _date_iso(raw),
            "portCalls": _num(raw.get("portcalls")),
            "portCallsByClass": by_class("portcalls"),
            "importTons": _num(raw.get("import")),
            "importByClass": by_class("import"),
            "exportTons": _num(raw.get("export")),
            "exportByClass": by_class("export"),
            "source": "portwatch",
        }

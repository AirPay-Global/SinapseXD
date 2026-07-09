"""UN Comtrade provider — official bilateral trade statistics.

Free, self-serve: register at https://comtrade.un.org/developers for a
subscription key (UN_COMTRADE_API_KEY). No reciprocal feed required, unlike
AISHub — closer in spirit to PortWatch as a regional data source.

API shape (comtradeapi.un.org, the current v1 API — the legacy
comtrade.un.org/api was retired):
  GET https://comtradeapi.un.org/data/v1/get/C/A/HS
    Header: Ocp-Apim-Subscription-Key: <key>
    reporterCode   ISO3 works via the `reporterISO` alias field on read;
                   the API itself is keyed by numeric M49 reporter/partner
                   codes, but every row in the response also carries
                   `reporterISO`/`partnerISO` alpha-3 fields we read from.
    partnerCode
    period         YYYY (annual) — Comtrade reporting lags ~1 year
    cmdCode        'TOTAL' for all-commodity value
    flowCode       'X' (exports) | 'M' (imports)
    format=json
  Response: { data: [ {reporterISO, partnerISO, period, flowCode, cmdCode,
                        primaryValue, netWgt, ...}, ... ] }

Comtrade's numeric reporter/partner codes must still be sent as query params
(the API doesn't accept ISO3 in the request), so REPORTER_M49 below maps our
pilot-country ISO3s to their M49 codes for the request; the response is read
back via the ISO3 alias fields so normalise() never has to reverse the map.
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://comtradeapi.un.org/data/v1/get/C/A/HS"

# M49 numeric codes for the pilot + corridor-partner countries (UN Comtrade
# reporter/partner query params — the ISO3 alpha codes only appear in the
# response, not the request).
REPORTER_M49: dict[str, str] = {
    "ZAF": "710", "KEN": "404", "NGA": "566", "TGO": "768", "DJI": "262",
    "TZA": "834", "GHA": "288", "ZMB": "894", "UGA": "800", "RWA": "646",
    "ETH": "231", "BFA": "854", "MLI": "466", "NER": "562",
}

# (coastal gateway country, inland partner country) per corridor — mirrors
# the ont_corridor seed in supabase/migrations/0002_ontology_core.sql.
CORRIDOR_COUNTRY_PAIRS: list[tuple[str, str]] = [
    ("ZAF", "ZMB"), ("KEN", "UGA"), ("TZA", "RWA"), ("DJI", "ETH"),
    ("TGO", "BFA"), ("GHA", "MLI"), ("NGA", "NER"),
]


def _num(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


class ComtradeProvider:
    queue_name = "trade.corridor.flows"

    def __init__(
        self,
        api_key: str | None = None,
        *,
        pairs: list[tuple[str, str]] | None = None,
        period: str | None = None,
        timeout: float = 30.0,
    ):
        self.api_key = api_key or os.environ.get("UN_COMTRADE_API_KEY", "")
        self.pairs = pairs or CORRIDOR_COUNTRY_PAIRS
        # Comtrade annual data lags — default to last year unless overridden.
        self.period = period or os.environ.get("UN_COMTRADE_PERIOD", "2025")
        self.timeout = timeout

    def fetch(self) -> list[dict]:
        if not self.api_key:
            logger.warning("UN_COMTRADE_API_KEY not set; trade ingestor idle (dashboards use demo data)")
            return []
        rows: list[dict] = []
        headers = {"Ocp-Apim-Subscription-Key": self.api_key}
        for reporter, partner in self.pairs:
            reporter_code = REPORTER_M49.get(reporter)
            partner_code = REPORTER_M49.get(partner)
            if not reporter_code or not partner_code:
                logger.warning("Comtrade: no M49 code for %s/%s, skipping", reporter, partner)
                continue
            for flow in ("X", "M"):
                params = {
                    "reporterCode": reporter_code,
                    "partnerCode": partner_code,
                    "period": self.period,
                    "cmdCode": "TOTAL",
                    "flowCode": flow,
                    "format": "json",
                }
                try:
                    resp = httpx.get(BASE_URL, params=params, headers=headers, timeout=self.timeout)
                    resp.raise_for_status()
                    payload = resp.json()
                except Exception:
                    logger.exception("Comtrade fetch failed for %s->%s flow=%s", reporter, partner, flow)
                    continue
                rows.extend(payload.get("data", []) or [])
        logger.info("Comtrade: fetched %d bilateral trade records", len(rows))
        return rows

    @staticmethod
    def normalise(raw: dict) -> dict:
        return {
            "reporterIso3": str(raw.get("reporterISO", "")).strip().upper(),
            "partnerIso3": str(raw.get("partnerISO", "")).strip().upper(),
            "flowCode": str(raw.get("flowCode", "")).strip().upper(),
            "cmdCode": str(raw.get("cmdCode", "TOTAL")).strip(),
            "period": str(raw.get("period", "")).strip(),
            "tradeValueUsd": _num(raw.get("primaryValue")),
            "netWeightKg": _num(raw.get("netWgt")),
            "source": "comtrade",
        }

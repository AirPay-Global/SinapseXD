"""World Bank Open Data provider — free, keyless, global economic indicators.

No registration, no key (unlike Freightos/Comtrade) — matches Open-Meteo as
the platform's other zero-friction free source.

API shape (documented at https://datahelpdesk.worldbank.org/knowledgebase/articles/889392):
  GET https://api.worldbank.org/v2/country/{iso3};{iso3};.../indicator/{code}
    ?format=json&per_page=<n>&mrnev=1     mrnev=1 = most recent non-empty value
  Response: [ {page, pages, ...}, [ {countryiso3code, date, value, indicator: {id}, ...}, ... ] ]
  Multiple countries can be queried in one call, semicolon-separated.
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.worldbank.org/v2/country/{countries}/indicator/{code}"

# World Bank indicator code → our economic_indicators.indicator label.
INDICATORS: dict[str, str] = {
    "NY.GDP.MKTP.CD": "gdp_usd",              # GDP (current US$)
    "NE.TRD.GNFS.ZS": "trade_pct_gdp",        # Trade (% of GDP) — SDG 17 relevant
    "NY.GDP.MKTP.KD.ZG": "gdp_growth_pct",    # GDP growth (annual %)
}

DEFAULT_COUNTRIES = [
    "ZAF", "KEN", "NGA", "TGO", "DJI", "TZA", "GHA",
    "ZMB", "UGA", "RWA", "ETH", "BFA", "MLI", "NER",
]


class WorldBankProvider:
    queue_name = "financial.economic.indicators"

    def __init__(
        self,
        *,
        countries: list[str] | None = None,
        indicators: dict[str, str] | None = None,
        timeout: float = 30.0,
    ):
        self.countries = countries or DEFAULT_COUNTRIES
        self.indicators = indicators or INDICATORS
        self.timeout = timeout

    def fetch(self) -> list[dict]:
        rows: list[dict] = []
        country_path = ";".join(self.countries)
        for code, label in self.indicators.items():
            url = BASE_URL.format(countries=country_path, code=code)
            try:
                resp = httpx.get(url, params={"format": "json", "per_page": 300, "mrnev": 1}, timeout=self.timeout)
                resp.raise_for_status()
                payload = resp.json()
            except Exception:
                logger.exception("World Bank fetch failed for indicator %s", code)
                continue
            if not isinstance(payload, list) or len(payload) < 2 or not payload[1]:
                logger.warning("World Bank: empty/unexpected response for %s", code)
                continue
            for row in payload[1]:
                row["_label"] = label
                rows.append(row)
        logger.info("World Bank: fetched %d indicator readings", len(rows))
        return rows

    @staticmethod
    def normalise(raw: dict) -> dict:
        return {
            "country": str(raw.get("countryiso3code", "")).strip().upper(),
            "indicator": raw.get("_label", ""),
            "value": raw.get("value"),
            "unit": None,
            "year": raw.get("date"),
            "source": "worldbank",
        }

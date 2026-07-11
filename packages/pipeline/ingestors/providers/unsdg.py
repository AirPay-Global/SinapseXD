"""UN SDG API provider — free, keyless official SDG indicator data.

API shape (documented at https://unstats.un.org/SDGAPI/swagger — the "Get
Data" endpoint):
  GET https://unstats.un.org/SDGAPI/v1/sdg/Series/Data
    ?seriesCode=<code>&areaCode=<M49>&pageSize=500
  Response: { totalElements, data: [ {series, seriesDescription, geoAreaCode,
              geoAreaName, timePeriodStart, value, ... , attributes,
              dimensions}, ... ] }
  areaCode is UN M49 (not ISO3) — same numeric-code translation problem as
  Comtrade, reusing the same map for our pilot countries.

Series chosen per goal — one well-established, broadly-reported series per
goal so the pilot has *something* real rather than reaching for indicators
too granular to have African country coverage:
  8.1.1  NY_GDP_PCAP  — GDP per capita growth (goal 8: decent work & growth)
  9.1.1  ITT_KEY      — replaced here with 9.5.1 R&D expenditure (SDG_921) is
                        too sparse for the pilot set; use 9.4.1 CO2 per unit
                        of value added (EG_EGY_PRIM) is also sparse — so goal
                        9 falls back to indicator 9.1.2 (freight volumes,
                        IS_RDP_TRFR) which most closely matches the platform's
                        own trade/logistics focus.
  10.1.1 SI_HEI_TOTL   — growth rate of household expenditure/income per capita
  17.1.1 GR_G14_GDP    — total government revenue as % of GDP
"""
from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://unstats.un.org/SDGAPI/v1/sdg/Series/Data"

# goal → (series code, our indicator_code label)
GOAL_SERIES: dict[int, tuple[str, str]] = {
    8: ("NY_GDP_PCAP", "8.1.1"),
    9: ("IS_RDP_TRFR", "9.1.2"),
    10: ("SI_HEI_TOTL", "10.1.1"),
    17: ("GR_G14_GDP", "17.1.1"),
}

# M49 numeric area codes for the pilot + corridor-partner countries — mirrors
# providers/comtrade.py's REPORTER_M49 (UN statistical APIs standardise on
# M49, not ISO3, for the area/reporter dimension).
AREA_M49: dict[str, str] = {
    "ZAF": "710", "KEN": "404", "NGA": "566", "TGO": "768", "DJI": "262",
    "TZA": "834", "GHA": "288", "ZMB": "894", "UGA": "800", "RWA": "646",
    "ETH": "231", "BFA": "854", "MLI": "466", "NER": "562",
}


def _num(value: object) -> float | None:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


class UnSdgProvider:
    queue_name = "sdg.indicators"

    def __init__(self, *, countries: list[str] | None = None, timeout: float = 30.0):
        self.countries = countries or list(AREA_M49.keys())
        self.timeout = timeout

    def fetch(self) -> list[dict]:
        rows: list[dict] = []
        for goal, (series_code, indicator_code) in GOAL_SERIES.items():
            for iso3 in self.countries:
                area = AREA_M49.get(iso3)
                if not area:
                    continue
                try:
                    resp = httpx.get(
                        BASE_URL,
                        params={"seriesCode": series_code, "areaCode": area, "pageSize": 10},
                        timeout=self.timeout,
                    )
                    resp.raise_for_status()
                    payload = resp.json()
                except Exception:
                    logger.exception("UN SDG fetch failed for series=%s area=%s", series_code, area)
                    continue
                for row in payload.get("data", []) or []:
                    row["_goal"] = goal
                    row["_indicatorCode"] = indicator_code
                    row["_iso3"] = iso3
                    rows.append(row)
        logger.info("UN SDG: fetched %d indicator readings", len(rows))
        return rows

    @staticmethod
    def normalise(raw: dict) -> dict:
        return {
            "country": raw.get("_iso3", ""),
            "goal": raw.get("_goal"),
            "indicatorCode": raw.get("_indicatorCode", ""),
            "value": _num(raw.get("value")),
            "target": None,
            "year": raw.get("timePeriodStart"),
            "source": "un-sdg-api",
        }

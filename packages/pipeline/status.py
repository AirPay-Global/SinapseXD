"""Pipeline status: where is data actually sitting right now?

Answers "is the data live?" end to end, in one place, from anywhere the
pipeline env vars are set — in particular a Render Shell on any pipeline
service. Reads only; writes nothing.

    python -m status

Shows, per pillar:
  * Redis queue depths — `wait` means the ingestor is producing but nothing
    is draining it; `processing` above zero when no consumer is running
    means jobs were orphaned mid-flight; `dead` means jobs exhausted their
    retries and need looking at.
  * Silver row counts and the newest timestamp — what the dashboards
    actually read. Rows but a stale newest-timestamp means ingestion
    stopped; zero rows means it never started.

Reading the result:
    queue wait high + Silver rows 0    -> consumer isn't running
    queue wait 0    + Silver rows 0    -> ingestor isn't producing (check keys)
    queue wait 0    + Silver rows > 0  -> healthy, draining as fast as it fills
"""
from __future__ import annotations

import os
import sys

# Queue -> Silver table it feeds. Keep in step with consumers/handlers.py.
PILLARS: list[tuple[str, str, str]] = [
    # (pillar label, queue name, silver table)
    ("AIS / vessels",  "ais.vessel.positions",     "vessel_positions"),
    ("Port activity",  "port.activity.daily",      "port_activity_daily"),
    ("Weather",        "weather.marine.forecast",  "marine_conditions"),
    ("Trade",          "trade.corridor.flows",     "trade_flows"),
    ("Market/freight", "market.freight.rates",     "freight_rates"),
    ("Financial",      "financial.port.data",      "economic_indicators"),
    ("SDG",            "sdg.indicators",           "sdg_indicators"),
]

# Column to read "newest row" from, where the table has an obvious one.
TIME_COLUMN = {
    "vessel_positions": "ts",
    "marine_conditions": "ts",
    "freight_rates": "ts",
    "port_activity_daily": "date",
    "trade_flows": "period",
}


def _queue_depths() -> dict[str, tuple[int, int, int]]:
    url = os.environ.get("UPSTASH_REDIS_URL")
    if not url:
        print("UPSTASH_REDIS_URL not set — skipping queue depths.\n", file=sys.stderr)
        return {}
    import redis

    try:
        r = redis.from_url(url)
        r.ping()
    except Exception as exc:
        print(f"Redis unreachable: {exc}\n", file=sys.stderr)
        return {}
    out = {}
    for _, queue, _ in PILLARS:
        out[queue] = (
            r.llen(f"bull:{queue}:wait"),
            r.llen(f"bull:{queue}:processing"),
            r.llen(f"bull:{queue}:dead"),
        )
    return out


def _table_stats() -> dict[str, tuple[int, str]]:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set — skipping Silver row counts.\n", file=sys.stderr)
        return {}
    import psycopg

    try:
        conn = psycopg.connect(url, prepare_threshold=None, autocommit=True)
    except Exception as exc:
        print(f"Postgres unreachable: {exc}\n", file=sys.stderr)
        return {}
    out = {}
    for _, _, table in PILLARS:
        try:
            count = conn.execute(f"select count(*) from {table}").fetchone()[0]
        except Exception:
            out[table] = (-1, "table missing")
            continue
        newest = ""
        col = TIME_COLUMN.get(table)
        if col and count:
            try:
                val = conn.execute(f"select max({col}) from {table}").fetchone()[0]
                newest = str(val) if val is not None else ""
            except Exception:
                newest = ""
        out[table] = (count, newest)
    return out


# Per pillar: the env var selecting its provider, that var's default, and
# which credential each provider needs (None = keyless). Resolved at runtime
# so the report reflects the provider actually configured, not a guess —
# reporting a credential the selected provider never reads is worse than
# reporting nothing, because it invents a problem that does not exist.
PILLAR_PROVIDERS: dict[str, tuple[str, str, dict[str, str | None]]] = {
    "AIS":            ("AIS_PROVIDER", "kpler", {
        "kpler": "KPLER_API_KEY", "aishub": "AISHUB_USERNAME",
        "marinetraffic": "MARINETRAFFIC_API_KEY"}),
    "Port activity":  ("PORT_ACTIVITY_PROVIDER", "portwatch", {"portwatch": None}),
    "Weather":        ("WEATHER_PROVIDER", "open-meteo", {
        "open-meteo": None, "stormglass": "STORMGLASS_API_KEY"}),
    "Trade":          ("TRADE_PROVIDER", "comtrade", {"comtrade": "UN_COMTRADE_API_KEY"}),
    "Market/freight": ("MARKET_PROVIDER", "freightos", {"freightos": "FREIGHTOS_API_KEY"}),
    "Financial":      ("FINANCIAL_PROVIDER", "worldbank", {"worldbank": None}),
}


def _print_config() -> None:
    """Which provider each pillar is actually configured to use, and whether
    what that provider needs is present. An ingestor whose credential is
    unset returns [] forever, which downstream cannot distinguish from "no
    data available" — this makes the difference visible."""
    print(f"{'PILLAR':<16} {'PROVIDER':<16} REQUIREMENT")
    print("-" * 78)
    for label, (var, default, creds) in PILLAR_PROVIDERS.items():
        chosen = os.environ.get(var, default).lower()
        suffix = "" if os.environ.get(var) else "  (default)"
        if chosen not in creds:
            note = f"!! unknown provider — known: {', '.join(creds)}"
        else:
            need = creds[chosen]
            if need is None:
                note = "keyless"
            elif os.environ.get(need):
                note = f"{need}: set"
            else:
                note = f"{need}: *** NOT SET -> idles, produces nothing ***"
        # PortWatch is keyless but additionally gated by a feature flag.
        if label == "Port activity" and os.environ.get("PORTWATCH_ENABLED", "false").lower() != "true":
            note = "keyless, but PORTWATCH_ENABLED is not 'true' -> idle"
        print(f"{label:<16} {chosen + suffix:<16} {note}")
    print()


def main() -> None:
    _print_config()
    depths = _queue_depths()
    stats = _table_stats()

    print(f"{'PILLAR':<16} {'WAIT':>6} {'PROC':>5} {'DEAD':>5}   {'SILVER ROWS':>11}  NEWEST")
    print("-" * 78)
    for label, queue, table in PILLARS:
        w, p, d = depths.get(queue, ("?", "?", "?"))
        count, newest = stats.get(table, ("?", ""))
        shown = "missing" if count == -1 else count
        print(f"{label:<16} {w:>6} {p:>5} {d:>5}   {shown:>11}  {newest}")

    if depths:
        total_dead = sum(d for _, _, d in depths.values())
        total_wait = sum(w for w, _, _ in depths.values())
        total_proc = sum(p for _, p, _ in depths.values())
        print()
        if total_wait and not any(c > 0 for c, _ in stats.values() if isinstance(c, int)):
            print("Jobs are queued but Silver is empty — the consumer is not draining.")
        elif total_wait:
            print(f"{total_wait} job(s) queued and waiting to be drained.")
        if total_proc:
            print(f"{total_proc} job(s) stuck in `processing` — orphaned by a stopped worker; "
                  "the consumer reclaims these via recover_stale() on its next start.")
        if total_dead:
            print(f"{total_dead} job(s) dead-lettered — these exhausted their retries "
                  "and are NOT in Postgres. Inspect `bull:<queue>:dead`.")


if __name__ == "__main__":
    main()

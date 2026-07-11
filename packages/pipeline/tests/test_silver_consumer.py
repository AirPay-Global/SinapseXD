"""Silver consumer integration test.

Exercises the full path: raw PortWatch record → provider.normalise() →
enqueue (producer shape) → SilverConsumer.drain_once() → Postgres upsert,
and asserts ontology keying + idempotency.

Requires a Postgres reachable at TEST_DATABASE_URL (the test applies the
ontology + Silver migrations itself). Skips cleanly when unset, so it never
blocks a run in an environment without a database.

    createdb sinapse_test
    TEST_DATABASE_URL=postgresql://localhost/sinapse_test \
      python -m pytest packages/pipeline/tests -q
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import pytest

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PIPELINE_ROOT.parents[1]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
sys.path.insert(0, str(PIPELINE_ROOT))

DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set")

# Supabase provides the `auth` schema in production; stub it so the RLS
# policies in the migrations apply against a bare Postgres.
AUTH_STUB = """
create schema if not exists auth;
create or replace function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
"""


def _psql(sql: str | None = None, file: Path | None = None) -> None:
    cmd = ["psql", DSN, "-v", "ON_ERROR_STOP=1", "-q"]
    if file:
        cmd += ["-f", str(file)]
        subprocess.run(cmd, check=True)
    else:
        subprocess.run(cmd, input=sql, text=True, check=True)


@pytest.fixture(scope="module")
def db():
    import psycopg

    _psql(AUTH_STUB)
    _psql(file=MIGRATIONS / "0001_intelligence_layer.sql")
    _psql(file=MIGRATIONS / "0002_ontology_core.sql")
    _psql(file=MIGRATIONS / "0003_silver_port_activity.sql")
    _psql(file=MIGRATIONS / "0007_ais_vessel_positions.sql")
    _psql(file=MIGRATIONS / "0008_silver_trade_flows.sql")
    _psql(file=MIGRATIONS / "0009_marine_conditions_ontology.sql")
    _psql(file=MIGRATIONS / "0010_ai_briefings_ontology.sql")
    _psql(file=MIGRATIONS / "0011_gold_sdg_and_economic.sql")
    conn = psycopg.connect(DSN)
    yield conn
    conn.close()


def _enqueue(redis_client, queue: str, record: dict) -> None:
    """Mirror base_ingestor.enqueue()'s job shape."""
    job = {"name": queue, "data": record, "ts": "2026-07-08T00:00:00Z"}
    redis_client.lpush(f"bull:{queue}:wait", json.dumps(job))


def test_portwatch_record_lands_ontology_keyed_and_idempotent(db):
    import fakeredis

    from consumers import SilverConsumer
    from ingestors.providers.portwatch import PortWatchProvider

    redis_client = fakeredis.FakeStrictRedis()
    queue = "port.activity.daily"

    raw = {
        "portid": "portZZ", "portname": "Durban", "country": "South Africa", "ISO3": "ZAF",
        "date": "2026-07-07",
        "portcalls_container": 3, "portcalls_tanker": 2, "portcalls": 6,
        "import": 35, "import_tanker": 20, "export": 5,
    }
    record = PortWatchProvider.normalise(raw)
    _enqueue(redis_client, queue, record)

    consumer = SilverConsumer(redis_client, db, queues=[queue])
    assert consumer.drain_once() == 1

    with db.cursor() as cur:
        cur.execute(
            "select canonical_port_id, country_iso3, port_calls, import_tons, "
            "port_calls_by_class from port_activity_daily "
            "where source_port_id = 'portZZ' and activity_date = '2026-07-07'"
        )
        row = cur.fetchone()
    assert row is not None
    canonical, iso3, calls, imp, by_class = row
    assert canonical == "durban"        # resolved to ontology key
    assert iso3 == "ZAF"
    assert calls == 6
    assert float(imp) == 35.0
    assert by_class["container"] == 3

    # Idempotency: same record again → still one row, no duplicate.
    _enqueue(redis_client, queue, record)
    assert consumer.drain_once() == 1
    with db.cursor() as cur:
        cur.execute(
            "select count(*) from port_activity_daily "
            "where source_port_id = 'portZZ' and activity_date = '2026-07-07'"
        )
        assert cur.fetchone()[0] == 1


def test_unresolved_port_stores_null_keys_without_error(db):
    import fakeredis

    from consumers import SilverConsumer
    from ingestors.providers.portwatch import PortWatchProvider

    redis_client = fakeredis.FakeStrictRedis()
    queue = "port.activity.daily"

    raw = {"portid": "port1411", "portname": "Yatsushiro", "country": "Japan",
           "ISO3": "JPN", "date": "2026-07-07", "portcalls": 0}
    _enqueue(redis_client, queue, PortWatchProvider.normalise(raw))

    consumer = SilverConsumer(redis_client, db, queues=[queue])
    assert consumer.drain_once() == 1
    with db.cursor() as cur:
        cur.execute(
            "select canonical_port_id, country_iso3 from port_activity_daily "
            "where source_port_id = 'port1411'"
        )
        canonical, iso3 = cur.fetchone()
    assert canonical is None and iso3 is None  # unknown port/country → NULL, FK-safe


def test_ais_position_lands_ontology_keyed_and_idempotent(db):
    import fakeredis

    from consumers import SilverConsumer
    from ingestors.providers.aishub import AISHubProvider

    redis_client = fakeredis.FakeStrictRedis()
    queue = "ais.vessel.positions"

    raw = {
        "MMSI": 601234567, "IMO": "9321483", "NAME": "MSC DURBAN", "TYPE": 71,
        "LATITUDE": -29.87, "LONGITUDE": 31.03, "SOG": 12.4, "HEADING": 90,
        "NAVSTAT": 0, "DEST": "DURBAN", "TIME": "20260709141530",
    }
    record = AISHubProvider.normalise(raw)
    _enqueue(redis_client, queue, record)

    consumer = SilverConsumer(redis_client, db, queues=[queue])
    assert consumer.drain_once() == 1

    with db.cursor() as cur:
        cur.execute(
            "select destination_port_id, name, vessel_type, speed_kn from vessel_positions "
            "where mmsi = '601234567' and ts = '2026-07-09T14:15:30+00:00'"
        )
        row = cur.fetchone()
    assert row is not None
    dest, name, vtype, speed = row
    assert dest == "durban"  # resolved via ontology.resolve_port
    assert name == "MSC DURBAN"
    assert vtype == "Cargo"
    assert float(speed) == 12.4

    # Idempotency: re-processing the same (mmsi, ts) upserts, doesn't duplicate.
    _enqueue(redis_client, queue, record)
    assert consumer.drain_once() == 1
    with db.cursor() as cur:
        cur.execute("select count(*) from vessel_positions where mmsi = '601234567'")
        assert cur.fetchone()[0] == 1


def test_ais_position_without_mmsi_is_dropped_not_errored(db):
    import fakeredis

    from consumers import SilverConsumer

    redis_client = fakeredis.FakeStrictRedis()
    queue = "ais.vessel.positions"
    _enqueue(redis_client, queue, {"mmsi": "", "tsIso": "2026-07-09T00:00:00+00:00"})

    consumer = SilverConsumer(redis_client, db, queues=[queue])
    # Handler runs (no exception) but inserts nothing — commit still happens.
    assert consumer.drain_once() == 1


def test_trade_flow_lands_ontology_keyed_and_feeds_corridor_mart(db):
    import fakeredis

    from consumers import SilverConsumer
    from ingestors.providers.comtrade import ComtradeProvider

    redis_client = fakeredis.FakeStrictRedis()
    queue = "trade.corridor.flows"

    raw_export = {
        "reporterISO": "zaf", "partnerISO": "zmb", "flowCode": "X", "cmdCode": "TOTAL",
        "period": "2025", "primaryValue": 1_200_000_000, "netWgt": 50_000_000,
    }
    raw_import = {
        "reporterISO": "zaf", "partnerISO": "zmb", "flowCode": "M", "cmdCode": "TOTAL",
        "period": "2025", "primaryValue": 300_000_000, "netWgt": 10_000_000,
    }
    for raw in (raw_export, raw_import):
        _enqueue(redis_client, queue, ComtradeProvider.normalise(raw))

    consumer = SilverConsumer(redis_client, db, queues=[queue])
    assert consumer.drain_once() == 2

    with db.cursor() as cur:
        cur.execute(
            "select trade_value_usd from trade_flows "
            "where reporter_iso3 = 'ZAF' and partner_iso3 = 'ZMB' and flow_code = 'X'"
        )
        assert float(cur.fetchone()[0]) == 1_200_000_000.0

    with db.cursor() as cur:
        cur.execute(
            "select trade_value_usd_latest from gold_corridor_trade_flows "
            "where corridor_id = 'durban-lusaka'"
        )
        total = cur.fetchone()[0]
    assert float(total) == 1_500_000_000.0  # export + import, same latest period

    # Idempotency: re-processing the export leg upserts, not duplicates.
    _enqueue(redis_client, queue, ComtradeProvider.normalise(raw_export))
    assert consumer.drain_once() == 1
    with db.cursor() as cur:
        cur.execute("select count(*) from trade_flows where reporter_iso3 = 'ZAF' and partner_iso3 = 'ZMB'")
        assert cur.fetchone()[0] == 2  # one row per (reporter,partner,flow), not per enqueue


def test_marine_conditions_lands_ontology_keyed_and_idempotent(db):
    import fakeredis

    from consumers import SilverConsumer
    from ingestors.providers.open_meteo import OpenMeteoProvider

    redis_client = fakeredis.FakeStrictRedis()
    queue = "weather.marine.forecast"

    raw = {
        "port": {"id": "durban", "name": "Durban", "lat": -29.87, "lng": 31.03},
        "marine": {"current": {"wave_height": 3.1, "wind_wave_height": 1.2}},
        "forecast": {"current_weather": {"windspeed": 40.0, "time": "2026-07-09T12:00"}},
    }
    record = OpenMeteoProvider.normalise(raw)
    _enqueue(redis_client, queue, record)

    consumer = SilverConsumer(redis_client, db, queues=[queue])
    assert consumer.drain_once() == 1

    with db.cursor() as cur:
        cur.execute(
            "select wave_height_m, disruption_risk from marine_conditions "
            "where ont_port_id = 'durban' and ts = '2026-07-09T12:00'"
        )
        wave, risk = cur.fetchone()
    assert float(wave) == 3.1
    assert risk == "elevated"  # wave >= 2.5m threshold

    _enqueue(redis_client, queue, record)
    assert consumer.drain_once() == 1
    with db.cursor() as cur:
        cur.execute("select count(*) from marine_conditions where ont_port_id = 'durban'")
        assert cur.fetchone()[0] == 1


def test_freight_rate_lands_and_idempotent(db):
    import fakeredis

    from consumers import SilverConsumer
    from ingestors.providers.freightos import FreightosProvider

    redis_client = fakeredis.FakeStrictRedis()
    queue = "market.freight.rates"

    raw = {"value": 1850.5, "date": "2026-07-09", "_route": "global-container-composite"}
    record = FreightosProvider.normalise(raw)
    _enqueue(redis_client, queue, record)

    consumer = SilverConsumer(redis_client, db, queues=[queue])
    assert consumer.drain_once() == 1

    with db.cursor() as cur:
        cur.execute(
            "select rate_usd from freight_rates where route = 'global-container-composite' "
            "and ts = '2026-07-09' and index_source = 'freightos'"
        )
        assert float(cur.fetchone()[0]) == 1850.5

    _enqueue(redis_client, queue, record)
    assert consumer.drain_once() == 1
    with db.cursor() as cur:
        cur.execute("select count(*) from freight_rates where route = 'global-container-composite'")
        assert cur.fetchone()[0] == 1


def test_economic_indicator_lands_and_feeds_gold_latest(db):
    import fakeredis

    from consumers import SilverConsumer
    from ingestors.providers.worldbank import WorldBankProvider

    redis_client = fakeredis.FakeStrictRedis()
    queue = "financial.port.data"

    older = WorldBankProvider.normalise({"countryiso3code": "zaf", "_label": "gdp_usd", "value": 400e9, "date": "2023"})
    newer = WorldBankProvider.normalise({"countryiso3code": "zaf", "_label": "gdp_usd", "value": 420e9, "date": "2024"})
    for rec in (older, newer):
        _enqueue(redis_client, queue, rec)

    consumer = SilverConsumer(redis_client, db, queues=[queue])
    assert consumer.drain_once() == 2

    with db.cursor() as cur:
        cur.execute("select value, year from gold_economic_latest where country = 'ZAF' and indicator = 'gdp_usd'")
        value, year = cur.fetchone()
    assert year == 2024
    assert float(value) == 420e9

    _enqueue(redis_client, queue, newer)
    assert consumer.drain_once() == 1
    with db.cursor() as cur:
        cur.execute("select count(*) from economic_indicators where country = 'ZAF' and indicator = 'gdp_usd'")
        assert cur.fetchone()[0] == 2  # 2023 + 2024, no duplicate of either


def test_sdg_indicator_lands_and_feeds_gold_latest(db):
    import fakeredis

    from consumers import SilverConsumer
    from ingestors.providers.unsdg import UnSdgProvider

    redis_client = fakeredis.FakeStrictRedis()
    queue = "sdg.indicators"

    raw = {"_iso3": "KEN", "_goal": 8, "_indicatorCode": "8.1.1", "value": "3.4", "timePeriodStart": 2024}
    record = UnSdgProvider.normalise(raw)
    _enqueue(redis_client, queue, record)

    consumer = SilverConsumer(redis_client, db, queues=[queue])
    assert consumer.drain_once() == 1

    with db.cursor() as cur:
        cur.execute("select value from gold_sdg_latest where country = 'KEN' and indicator_code = '8.1.1'")
        assert float(cur.fetchone()[0]) == 3.4

    _enqueue(redis_client, queue, record)
    assert consumer.drain_once() == 1
    with db.cursor() as cur:
        cur.execute("select count(*) from sdg_indicators where country = 'KEN' and indicator_code = '8.1.1'")
        assert cur.fetchone()[0] == 1

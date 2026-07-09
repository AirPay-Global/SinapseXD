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
    _psql(file=MIGRATIONS / "0002_ontology_core.sql")
    _psql(file=MIGRATIONS / "0003_silver_port_activity.sql")
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

"""Partition-maintenance integration test (code review finding: time-series
ingestion has a fixed expiration date — 0001/0003 seeded partitions only a
few months/years ahead with a comment promising a cron that never existed).

Requires TEST_DATABASE_URL (applies the full migration chain). Skips cleanly
when unset, same convention as the other DB-integration tests.

Test order matters here (pytest runs a module's tests in source order): the
DEFAULT-conflict test must run before any test that widens the partition
horizon far enough to have already created the range it depends on being
empty. Keep it early in the file.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PIPELINE_ROOT.parents[1]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
sys.path.insert(0, str(PIPELINE_ROOT))

DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set")

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
    for f in sorted(MIGRATIONS.glob("*.sql")):
        _psql(file=f)
    conn = psycopg.connect(DSN)
    yield conn
    conn.close()


def test_insert_beyond_originally_seeded_partitions_succeeds(db):
    """The exact failure the finding describes: 0001 only seeded partitions
    through October 2026. This date is well beyond that — it must land
    somewhere (a maintained partition or the default), never raise."""
    with db.cursor() as cur:
        cur.execute(
            "insert into vessel_positions (mmsi, ts, lat, lng, status, source) "
            "values ('000000001', '2027-03-15T00:00:00Z', -29.87, 31.03, 'underway', 'ais')"
        )
        cur.execute("select tableoid::regclass::text from vessel_positions where mmsi = '000000001'")
        (relation,) = cur.fetchone()
    db.commit()
    assert relation.startswith("vessel_positions")


def test_far_future_insert_lands_in_monitorable_default_partition(db):
    """A date far beyond even ensure_future_partitions()'s look-ahead window
    must still succeed (never a hard insert failure) by falling into the
    DEFAULT partition — proving the safety net, not just the schedule."""
    with db.cursor() as cur:
        cur.execute(
            "insert into port_activity_daily (source, source_port_id, activity_date, port_calls) "
            "values ('portwatch', 'far-future-test', '2099-01-01', 1)"
        )
        cur.execute(
            "select tableoid::regclass::text from port_activity_daily where source_port_id = 'far-future-test'"
        )
        (relation,) = cur.fetchone()
    db.commit()
    assert relation == "port_activity_daily_default"


def test_default_partition_conflict_does_not_abort_the_whole_run(db):
    """If a row already landed in DEFAULT for a range ensure_future_partitions
    later tries to carve out as a real partition, Postgres refuses that one
    CREATE TABLE (it must verify DEFAULT holds no rows in the new range) —
    but that must degrade to a warning for that one partition, not an
    exception that aborts every other partition the call would have made.

    Must run before any test that widens the horizon past 2028-05 for
    marine_conditions/vessel_positions (see module docstring)."""
    with db.cursor() as cur:
        # Land a row in marine_conditions' DEFAULT partition for a date
        # nothing has created a real partition for yet.
        cur.execute(
            "insert into marine_conditions (ont_port_id, ts, wave_height_m, wind_speed_kn, source) "
            "values ('durban', '2028-05-01T00:00:00Z', 1.0, 10, 'open-meteo')"
        )
        cur.execute(
            "select tableoid::regclass::text from marine_conditions "
            "where ont_port_id = 'durban' and ts = '2028-05-01T00:00:00Z'"
        )
        (relation,) = cur.fetchone()
        assert relation == "marine_conditions_default"

        # Now ask for partitions far enough ahead to include 2028-05 — the
        # marine_conditions_202805 create must fail internally (conflicting
        # DEFAULT row) but the call itself must not raise.
        cur.execute("select ensure_future_partitions(months_ahead => 36)")

        # And a different table's partition from the same call still landed,
        # proving the one conflict didn't abort the rest of the function.
        cur.execute(
            "select exists (select 1 from pg_class where relname = 'vessel_positions_202805')"
        )
        (sibling_partition_created,) = cur.fetchone()
    db.commit()
    assert sibling_partition_created


def test_ensure_future_partitions_is_idempotent(db):
    """Calling it twice must not raise (duplicate_table) — required for a
    function that's meant to be safely re-run on a schedule or by hand."""
    with db.cursor() as cur:
        cur.execute("select ensure_future_partitions()")
        cur.execute("select ensure_future_partitions()")
    db.commit()  # no exception raised = pass


def test_ensure_future_partitions_actually_extends_the_range(db):
    """Calling with a larger horizon creates a partition that didn't exist a
    moment ago — proves this isn't a no-op. 2036 is far beyond every prior
    test's horizon in this module, so it's guaranteed not to exist yet."""
    with db.cursor() as cur:
        cur.execute(
            "select exists (select 1 from pg_class where relname = 'freight_rates_203601')"
        )
        (existed_before,) = cur.fetchone()
        assert not existed_before

        cur.execute("select ensure_future_partitions(months_ahead => 120)")

        cur.execute(
            "select exists (select 1 from pg_class where relname = 'freight_rates_203601')"
        )
        (exists_after,) = cur.fetchone()
    db.commit()
    assert exists_after

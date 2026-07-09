"""Bronze landing tests.

The Parquet round-trip runs anywhere (no DB). The end-to-end run() test —
raw landed + lineage catalogued + lineageRef attached to enqueued records —
needs TEST_DATABASE_URL (applies migration 0004 itself), and skips cleanly
when unset.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pyarrow.parquet as pq
import pytest

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PIPELINE_ROOT.parents[1]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
sys.path.insert(0, str(PIPELINE_ROOT))

from ingestors.base_ingestor import BaseIngestor  # noqa: E402
from lake import BronzeLake, LineageCatalog, LocalBronzeStore  # noqa: E402
from lake.bronze import _to_parquet  # noqa: E402

DSN = os.environ.get("TEST_DATABASE_URL")


def test_bronze_local_roundtrip_and_partitioned_key(tmp_path):
    lake = BronzeLake(LocalBronzeStore(tmp_path))
    records = [
        {"MMSI": "636092933", "NAME": "MSC ALIYA", "SOG": 12.4},
        {"MMSI": "657000111", "NAME": "KOTA JUBILEE", "SOG": 0.0},
    ]
    landing = lake.land("ais", "aishub", records)

    assert landing.row_count == 2
    assert landing.ref.startswith("ais/aishub/date=")
    assert landing.ref.endswith(".parquet")
    assert len(landing.sha256) == 64

    path = tmp_path / landing.ref
    assert path.exists()
    # Read the file directly (ParquetFile), not via the dataset API, so the
    # Hive-style date=… partition dir isn't injected as a column.
    assert pq.ParquetFile(str(path)).read().to_pylist() == records  # replayable, exact

    # Content-addressed: identical records serialise to identical bytes.
    assert _to_parquet(records) == _to_parquet(records)


class _FakeIngestor(BaseIngestor):
    queue_name = "test.q"
    pillar = "ais"
    source = "aishub"

    def __init__(self, raw):
        self._raw = raw
        self.captured: list[dict] = []

    def fetch(self):
        return self._raw

    def normalise(self, raw):
        return {"mmsi": raw["MMSI"]}

    def enqueue(self, records):  # capture instead of hitting Redis
        self.captured = records


@pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set")
def test_run_lands_raw_catalogs_lineage_and_attaches_ref(tmp_path):
    import psycopg

    subprocess.run(
        ["psql", DSN, "-v", "ON_ERROR_STOP=1", "-q"],
        input="create schema if not exists auth;"
        " create or replace function auth.role() returns text language sql stable as $$ select 'authenticated' $$;",
        text=True,
        check=True,
    )
    subprocess.run(
        ["psql", DSN, "-v", "ON_ERROR_STOP=1", "-q", "-f", str(MIGRATIONS / "0004_bronze_lineage.sql")],
        check=True,
    )
    conn = psycopg.connect(DSN)

    ing = _FakeIngestor([{"MMSI": "1"}, {"MMSI": "2"}])
    ing.bronze = BronzeLake(LocalBronzeStore(tmp_path))
    ing.lineage = LineageCatalog(conn)
    ing.run()

    # Every enqueued record carries the same lineageRef.
    assert ing.captured and all("lineageRef" in r for r in ing.captured)
    ref = ing.captured[0]["lineageRef"]
    assert all(r["lineageRef"] == ref for r in ing.captured)

    # Raw Parquet landed at that ref.
    assert (tmp_path / ref).exists()

    # Lineage catalogued with the right provenance.
    with conn.cursor() as cur:
        cur.execute(
            "select pillar, source, row_count from bronze_objects where ref = %s", (ref,)
        )
        row = cur.fetchone()
    assert row == ("ais", "aishub", 2)
    conn.close()

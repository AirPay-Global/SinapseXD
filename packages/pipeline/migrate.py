"""Apply supabase/migrations/*.sql to DATABASE_URL, idempotently.

Why this exists: the Supabase CLI (`supabase db push`) needs a local install
plus the project's DB password, and pasting the migrations into the dashboard
SQL Editor by hand is error-prone and unrepeatable. This runner executes the
same files from anywhere DATABASE_URL is already set — in particular from a
Render Shell on any of the pipeline services, which already carry the
sinapse-xd-env group. No secret ever has to move.

Usage (from the Render Shell on a pipeline service, or locally with
DATABASE_URL exported):

    python -m migrate --check     # report state, write nothing
    python -m migrate --dry-run   # list what would be applied
    python -m migrate             # apply everything pending

Safety properties:
  * A `schema_migrations` ledger records what has been applied, so re-running
    is a no-op rather than a double-apply. The migrations are NOT individually
    idempotent (0001 creates types/tables unconditionally, 0009 ALTERs what
    0001 created), so the ledger — not `if not exists` — is what makes this
    safe to re-run.
  * Each file runs in its own transaction: a failure rolls that file back
    whole and stops the run, rather than leaving a half-applied schema.
  * Files are applied in sorted filename order (0001 → 0014), which is the
    order they depend on each other in.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger("migrate")

# packages/pipeline/migrate.py -> repo root -> supabase/migrations
MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "supabase" / "migrations"

LEDGER_DDL = """
create table if not exists schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
)
"""

# One signature object per migration, so --check can tell which files are
# actually present in the database rather than trusting the ledger alone.
# This matters because a schema applied by other means (`supabase db push`
# records into supabase_migrations.schema_migrations, a different schema;
# hand-pasting into the SQL Editor records nothing at all) leaves this
# ledger empty while the objects very much exist — and blindly "applying"
# 0001 on top of that just fails on `type org_type already exists`.
SIGNATURES: list[tuple[str, str, str]] = [
    # (migration filename, object kind, object name)
    ("0001_intelligence_layer.sql",      "type",  "org_type"),
    ("0002_ontology_core.sql",           "table", "ont_country"),
    ("0003_silver_port_activity.sql",    "table", "port_activity_daily"),
    ("0004_bronze_lineage.sql",          "table", "bronze_objects"),
    ("0005_gold_port_marts.sql",         "table", "gold_port_calls_daily"),
    ("0006_gold_corridor_gateway.sql",   "table", "gold_corridor_gateway_activity"),
    ("0007_ais_vessel_positions.sql",    "index", "vessel_positions_mmsi_ts_idx"),
    ("0008_silver_trade_flows.sql",      "table", "trade_flows"),
    ("0009_marine_conditions_ontology.sql", "index", "marine_conditions_port_ts_idx"),
    ("0010_ai_briefings_ontology.sql",   "index", "ai_briefings_corridor_date_idx"),
    ("0011_gold_sdg_and_economic.sql",   "table", "gold_sdg_latest"),
    ("0012_aprm_reports.sql",            "index", "aprm_reports_org_period_idx"),
    ("0013_satellite_berths.sql",        "table", "satellite_berths"),
    ("0014_partition_maintenance.sql",   "func",  "ensure_future_partitions"),
]


def _object_exists(conn, kind: str, name: str) -> bool:
    """to_regclass covers tables, views and indexes alike; types and
    functions need their own registries."""
    if kind in ("table", "index"):
        sql, param = "select to_regclass(%s) is not null", name
    elif kind == "type":
        sql, param = "select to_regtype(%s) is not null", name
    elif kind == "func":
        sql, param = "select exists (select 1 from pg_proc where proname = %s)", name
    else:  # pragma: no cover - guard against a typo in SIGNATURES
        raise ValueError(f"unknown signature kind {kind!r}")
    return bool(conn.execute(sql, (param,)).fetchone()[0])


def _present_migrations(conn) -> dict[str, bool]:
    return {fn: _object_exists(conn, kind, name) for fn, kind, name in SIGNATURES}


def _connect():
    import psycopg

    url = os.environ.get("DATABASE_URL")
    if not url:
        logger.error(
            "DATABASE_URL is not set. In a Render Shell it comes from the "
            "sinapse-xd-env group; locally, export it first."
        )
        sys.exit(1)
    try:
        # prepare_threshold=None for the same reason as the Silver consumer:
        # psycopg3's automatic prepared statements break under Supabase's
        # transaction-mode pooler (PgBouncer on :6543).
        return psycopg.connect(url, prepare_threshold=None, autocommit=True)
    except Exception as exc:
        logger.error("Cannot connect to DATABASE_URL: %s", exc)
        sys.exit(1)


def _migration_files() -> list[Path]:
    if not MIGRATIONS_DIR.is_dir():
        logger.error("Migrations directory not found at %s", MIGRATIONS_DIR)
        sys.exit(1)
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def _applied(conn) -> set[str]:
    conn.execute(LEDGER_DDL)
    rows = conn.execute("select filename from schema_migrations").fetchall()
    return {r[0] for r in rows}


def _report(conn, files: list[Path], applied: set[str]) -> None:
    present = _present_migrations(conn)
    print(f"migrations on disk : {len(files)}")
    print(f"recorded in ledger : {len(applied)}")
    print(f"present in database: {sum(present.values())}\n")
    print(f"{'MIGRATION':<40} {'LEDGER':<9} {'IN DB'}")
    for f in files:
        in_ledger = "yes" if f.name in applied else "-"
        in_db = present.get(f.name)
        mark = "yes" if in_db else ("no" if in_db is not None else "?")
        print(f"{f.name:<40} {in_ledger:<9} {mark}")

    untracked = [f.name for f in files if f.name not in applied and present.get(f.name)]
    missing = [f.name for f in files if not present.get(f.name)]
    print()
    if untracked and not missing:
        print(
            "All migrations are present in the database but absent from this\n"
            "ledger — the schema was applied by other means. Run\n"
            "`python -m migrate --baseline` to record them as applied; do NOT\n"
            "run a plain apply, which would fail trying to recreate them."
        )
    elif untracked and missing:
        print(
            "MIXED STATE: some migrations exist in the database but are not in\n"
            "the ledger, and others are missing entirely. Applying blindly will\n"
            "fail on the already-present ones. Resolve this deliberately —\n"
            "do not guess.\n"
            f"  present but untracked: {', '.join(untracked)}\n"
            f"  missing from database: {', '.join(missing)}"
        )
    elif missing:
        print(f"{len(missing)} migration(s) not yet in the database — a plain apply is safe.")
    else:
        print("Ledger and database agree — nothing to do.")


def _baseline(conn, files: list[Path], applied: set[str]) -> None:
    """Record already-present migrations as applied, without running them.
    For a database whose schema was built by some other route (Supabase CLI,
    dashboard SQL Editor) so this ledger never saw them."""
    present = _present_migrations(conn)
    to_record = [f.name for f in files if f.name not in applied and present.get(f.name)]
    not_present = [f.name for f in files if not present.get(f.name)]
    if not to_record:
        logger.info("Nothing to baseline — ledger already matches what's in the database.")
        return
    if not_present:
        logger.error(
            "Refusing to baseline: %d migration(s) are NOT present in the database "
            "(%s). Baselining would permanently mark them applied and they would "
            "never run. Resolve the mixed state first.",
            len(not_present), ", ".join(not_present),
        )
        sys.exit(1)
    with conn.transaction():
        for name in to_record:
            conn.execute("insert into schema_migrations (filename) values (%s)", (name,))
    logger.info("Baselined %d migration(s) as already applied:", len(to_record))
    for name in to_record:
        logger.info("  %s", name)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    parser = argparse.ArgumentParser(description="Apply Sinapse XD Supabase migrations.")
    parser.add_argument("--check", action="store_true", help="report state and exit, writing nothing but the ledger table")
    parser.add_argument("--dry-run", action="store_true", help="list pending migrations without applying them")
    parser.add_argument(
        "--baseline", action="store_true",
        help="record migrations already present in the database as applied, without running them "
             "(for a schema built via the Supabase CLI or dashboard, which this ledger never saw)",
    )
    args = parser.parse_args()

    files = _migration_files()
    conn = _connect()
    applied = _applied(conn)

    if args.check or args.dry_run:
        _report(conn, files, applied)
        return

    if args.baseline:
        _baseline(conn, files, applied)
        return

    # Guard the plain-apply path: if a "pending" migration's objects are
    # already in the database, applying it will just fail on a duplicate
    # object. Say so up front instead of failing mid-run.
    present = _present_migrations(conn)
    untracked = [f.name for f in files if f.name not in applied and present.get(f.name)]
    if untracked:
        logger.error(
            "%d migration(s) are already present in the database but missing from "
            "the ledger: %s", len(untracked), ", ".join(untracked),
        )
        logger.error(
            "Applying them would fail on duplicate objects. Run "
            "`python -m migrate --check` to see the full picture, then "
            "`python -m migrate --baseline` to record them as applied."
        )
        sys.exit(1)

    pending = [f for f in files if f.name not in applied]
    if not pending:
        logger.info("Nothing to do — all %d migration(s) already applied.", len(files))
        return

    logger.info("Applying %d pending migration(s)...", len(pending))
    for path in pending:
        sql = path.read_text()
        try:
            with conn.transaction():
                conn.execute(sql)
                conn.execute(
                    "insert into schema_migrations (filename) values (%s)", (path.name,)
                )
        except Exception as exc:
            logger.error("FAILED on %s — rolled back, nothing partially applied.", path.name)
            logger.error("%s", exc)
            logger.error(
                "Earlier migrations in this run are already committed and recorded; "
                "fix the cause and re-run — completed files will be skipped."
            )
            sys.exit(1)
        logger.info("  applied %s", path.name)

    logger.info("Done — %d migration(s) applied.", len(pending))


if __name__ == "__main__":
    main()

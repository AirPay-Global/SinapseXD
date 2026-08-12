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
    pending = [f for f in files if f.name not in applied]
    print(f"migrations on disk : {len(files)}")
    print(f"already applied    : {len(applied)}")
    print(f"pending            : {len(pending)}")
    if pending:
        print("\nPending:")
        for f in pending:
            print(f"  - {f.name}")
    # Spot-check a few tables the dashboards actually read, so a mismatch
    # between the ledger and reality is visible rather than assumed.
    probe = [
        "organisations", "ont_port", "vessel_positions",
        "marine_conditions", "port_activity_daily", "sdg_indicators",
    ]
    print("\nTable presence:")
    for name in probe:
        exists = conn.execute("select to_regclass(%s) is not null", (name,)).fetchone()[0]
        print(f"  {'✓' if exists else '✗'} {name}")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    parser = argparse.ArgumentParser(description="Apply Sinapse XD Supabase migrations.")
    parser.add_argument("--check", action="store_true", help="report state and exit, writing nothing but the ledger table")
    parser.add_argument("--dry-run", action="store_true", help="list pending migrations without applying them")
    args = parser.parse_args()

    files = _migration_files()
    conn = _connect()
    applied = _applied(conn)

    if args.check or args.dry_run:
        _report(conn, files, applied)
        return

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

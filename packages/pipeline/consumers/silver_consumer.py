"""Silver consumer worker.

Drains normalised records off the pipeline queues and upserts them into the
Silver Postgres tables via the per-queue handlers. Runs as a Render background
worker; `drain_once` is the unit the verification harness exercises.

Delivery is at-least-once (a crash mid-batch re-delivers), and every handler
upsert is idempotent, so re-processing is safe.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time

from .handlers import HANDLERS

logger = logging.getLogger(__name__)

REQUIRED_ENV = ("DATABASE_URL", "UPSTASH_REDIS_URL")


class SilverConsumer:
    def __init__(self, redis_client, pg_conn, queues: list[str] | None = None):
        self.redis = redis_client
        self.conn = pg_conn
        self.queues = queues or list(HANDLERS.keys())

    @staticmethod
    def _list_key(queue: str) -> str:
        # Matches the producer in base_ingestor.enqueue().
        return f"bull:{queue}:wait"

    def _process(self, queue: str, payload: str) -> bool:
        handler = HANDLERS.get(queue)
        if handler is None:
            logger.error("no Silver handler for queue %s; dropping", queue)
            return False
        try:
            job = json.loads(payload)
            record = job.get("data", job)
            handler(self.conn, record)
            self.conn.commit()
            return True
        except Exception:
            self.conn.rollback()
            logger.exception("Silver upsert failed on %s", queue)
            return False

    def drain_once(self) -> int:
        """Process every job currently waiting across all queues. Returns the
        count successfully upserted. Non-blocking — used by tests and as the
        body of the run loop."""
        processed = 0
        for queue in self.queues:
            key = self._list_key(queue)
            while True:
                payload = self.redis.rpop(key)
                if payload is None:
                    break
                if isinstance(payload, bytes):
                    payload = payload.decode()
                if self._process(queue, payload):
                    processed += 1
        return processed

    def run(self, poll_seconds: float = 2.0) -> None:
        logger.info("Silver consumer watching queues: %s", ", ".join(self.queues))
        while True:
            if self.drain_once() == 0:
                time.sleep(poll_seconds)


def _main() -> None:
    import psycopg
    import redis

    logging.basicConfig(level=logging.INFO)

    # Fail fast with a readable, actionable message — a bare KeyError
    # traceback from os.environ[...] isn't diagnosable in Render's logs.
    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        logger.error(
            "Silver consumer cannot start — missing required env var(s): %s. "
            "Set these on the sinapse-xd-env Environment Group in Render.",
            ", ".join(missing),
        )
        sys.exit(1)

    try:
        # prepare_threshold=None disables psycopg3's automatic prepared
        # statements, which break under Supabase's transaction-mode pooler
        # (PgBouncer on :6543). Use the pooler host — not the direct
        # db.<ref>.supabase.co host, which is IPv6-only and unreachable from
        # Render. Session pooler (:5432) or transaction pooler (:6543) both
        # work with this setting; see .env.example.
        conn = psycopg.connect(os.environ["DATABASE_URL"], prepare_threshold=None)
    except Exception as exc:
        logger.error(
            "Silver consumer cannot connect to DATABASE_URL: %s. "
            "Use the Supabase pooler host (aws-0-<region>.pooler.supabase.com), "
            "not the direct db.<ref>.supabase.co host (IPv6-only, unreachable from Render).",
            exc,
        )
        sys.exit(1)

    try:
        client = redis.from_url(os.environ["UPSTASH_REDIS_URL"])
        client.ping()
    except Exception as exc:
        logger.error("Silver consumer cannot connect to UPSTASH_REDIS_URL: %s", exc)
        sys.exit(1)

    SilverConsumer(client, conn).run()


if __name__ == "__main__":
    _main()

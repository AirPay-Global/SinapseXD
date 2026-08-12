"""Silver consumer worker.

Drains normalised records off the pipeline queues and upserts them into the
Silver Postgres tables via the per-queue handlers. Runs as a Render background
worker; `drain_once` is the unit the verification harness exercises.

Delivery is reliable, not "RPOP and hope": a job is atomically moved from the
`wait` list to a per-queue `processing` list (LMOVE, same guarantee as
RPOPLPUSH) before it is handled, so a crash between dequeue and commit leaves
the job recoverable rather than gone. On success the job is removed from
`processing`. On failure it is re-queued (front of `wait`, so it's retried
before newer work) up to MAX_ATTEMPTS, then moved to a per-queue `dead` list
for manual inspection — nothing is silently dropped. `recover_stale()` sweeps
`processing` back onto `wait` on startup, reclaiming anything orphaned by a
worker that crashed mid-handler in a previous run.
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

# BullMQ's own default (packages/pipeline docs / CLAUDE.md §6.2): 3 attempts
# before a job is considered poison and moved to the dead-letter list.
MAX_ATTEMPTS = 3


class SilverConsumer:
    def __init__(self, redis_client, pg_conn, queues: list[str] | None = None):
        self.redis = redis_client
        self.conn = pg_conn
        self.queues = queues or list(HANDLERS.keys())

    @staticmethod
    def _list_key(queue: str) -> str:
        # Matches the producer in base_ingestor.enqueue().
        return f"bull:{queue}:wait"

    @staticmethod
    def _processing_key(queue: str) -> str:
        return f"bull:{queue}:processing"

    @staticmethod
    def _dead_key(queue: str) -> str:
        return f"bull:{queue}:dead"

    def recover_stale(self) -> int:
        """Move anything left in a `processing` list back onto `wait`. Only
        safe to call when no other consumer instance is concurrently
        processing (i.e. on startup) — this is a best-effort reclaim of jobs
        orphaned by a worker that died between dequeue and ack, not a
        general-purpose visibility-timeout sweep."""
        recovered = 0
        for queue in self.queues:
            proc_key = self._processing_key(queue)
            wait_key = self._list_key(queue)
            while True:
                payload = self.redis.lmove(proc_key, wait_key, "RIGHT", "LEFT")
                if payload is None:
                    break
                recovered += 1
        if recovered:
            logger.warning("recovered %d job(s) orphaned by a previous run", recovered)
        return recovered

    def _attempts(self, job: dict) -> int:
        return int(job.get("attempts", 0))

    def _process(self, queue: str, raw_payload: str) -> bool:
        proc_key = self._processing_key(queue)
        handler = HANDLERS.get(queue)
        if handler is None:
            logger.error("no Silver handler for queue %s; dead-lettering", queue)
            self.redis.lrem(proc_key, 1, raw_payload)
            self.redis.lpush(self._dead_key(queue), raw_payload)
            return False

        try:
            job = json.loads(raw_payload)
        except Exception:
            logger.exception("malformed job on %s; dead-lettering (not valid JSON)", queue)
            self.redis.lrem(proc_key, 1, raw_payload)
            self.redis.lpush(self._dead_key(queue), raw_payload)
            return False

        record = job.get("data", job)
        try:
            handler(self.conn, record)
            self.conn.commit()
            self.redis.lrem(proc_key, 1, raw_payload)
            return True
        except Exception:
            self.conn.rollback()
            attempts = self._attempts(job) + 1
            logger.exception("Silver upsert failed on %s (attempt %d/%d)", queue, attempts, MAX_ATTEMPTS)
            self.redis.lrem(proc_key, 1, raw_payload)
            if attempts >= MAX_ATTEMPTS:
                job["attempts"] = attempts
                job["lastError"] = "handler raised — see worker logs for traceback"
                self.redis.lpush(self._dead_key(queue), json.dumps(job))
                logger.error("%s job exhausted %d attempts; moved to dead-letter list", queue, MAX_ATTEMPTS)
            else:
                job["attempts"] = attempts
                # Front of wait: retried before newer work, not lost behind it.
                self.redis.lpush(self._list_key(queue), json.dumps(job))
            return False

    def drain_once(self) -> int:
        """Process every job that was waiting at the start of this call.
        Returns the count successfully upserted. Non-blocking — used by
        tests and as the body of the run loop.

        Bounded by the queue's length at entry, not "until empty": a failed
        job gets re-queued onto the same `wait` list, and an unbounded loop
        would immediately re-dequeue and retry it in the same pass — burning
        through MAX_ATTEMPTS synchronously with no real backoff between
        attempts. Capping at the starting length means a retried job waits
        for the next poll cycle instead."""
        processed = 0
        for queue in self.queues:
            wait_key = self._list_key(queue)
            proc_key = self._processing_key(queue)
            budget = self.redis.llen(wait_key)
            for _ in range(budget):
                # Atomic move wait -> processing (RPOPLPUSH semantics): a crash
                # right after this line still has the job in `processing`,
                # recoverable by recover_stale() on the next startup — it is
                # never just gone the way a bare RPOP would leave it.
                payload = self.redis.lmove(wait_key, proc_key, "RIGHT", "LEFT")
                if payload is None:
                    break
                if isinstance(payload, bytes):
                    payload = payload.decode()
                if self._process(queue, payload):
                    processed += 1
        return processed

    def run(self, poll_seconds: float = 2.0, max_iterations: int | None = None) -> None:
        """Long-running loop for the Render worker process. Each iteration
        (including recover_stale()) is guarded: a transient Redis/Postgres
        connectivity blip must not crash the whole worker and trigger
        Render's crash-loop suspension — it should log and retry next cycle,
        same pattern as ais_ingestor.poll_forever(). max_iterations is
        test-only, to make the loop terminate rather than run forever."""
        logger.info("Silver consumer watching queues: %s", ", ".join(self.queues))
        try:
            self.recover_stale()
        except Exception:
            logger.exception("recover_stale() failed at startup; continuing without it")
        i = 0
        while max_iterations is None or i < max_iterations:
            try:
                if self.drain_once() == 0:
                    time.sleep(poll_seconds)
            except Exception:
                logger.exception("Silver consumer iteration failed; will retry next cycle")
                time.sleep(poll_seconds)
            i += 1


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

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
import time

from .handlers import HANDLERS

logger = logging.getLogger(__name__)


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
    conn = psycopg.connect(os.environ["DATABASE_URL"])
    client = redis.from_url(os.environ["UPSTASH_REDIS_URL"])
    SilverConsumer(client, conn).run()


if __name__ == "__main__":
    _main()

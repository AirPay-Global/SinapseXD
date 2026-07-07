"""Base ingestor for the 6 external data pillars.

Each pillar subclasses BaseIngestor and runs as an independent Render
worker/cron. The queue layer is pluggable: Sinapse CRM can register as a 7th
source later by adding one subclass + queue name — no changes here.
"""
from __future__ import annotations

import json
import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class BaseIngestor(ABC):
    #: BullMQ queue name, e.g. "ais.vessel.positions"
    queue_name: str

    @abstractmethod
    def fetch(self) -> list[dict]:
        """Pull raw records from the external API."""

    @abstractmethod
    def normalise(self, raw: dict) -> dict:
        """Map a raw record to the Sinapse XD schema (UTC timestamps)."""

    def enqueue(self, records: list[dict]) -> None:
        """Push normalised records to the BullMQ queue on Upstash Redis.

        BullMQ job settings live on the worker side: attempts=3,
        exponential backoff 5s, dead-letter queue on exhaustion.
        """
        import redis

        client = redis.from_url(os.environ["UPSTASH_REDIS_URL"])
        for record in records:
            job = {
                "name": self.queue_name,
                "data": record,
                "ts": datetime.now(timezone.utc).isoformat(),
            }
            client.lpush(f"bull:{self.queue_name}:wait", json.dumps(job))
        logger.info("enqueued %d records to %s", len(records), self.queue_name)

    def run(self) -> None:
        raw = self.fetch()
        records = [self.normalise(r) for r in raw]
        # Idempotency: normalise() must emit a stable natural key per record
        # (e.g. imo+timestamp) so re-runs upsert rather than duplicate.
        self.enqueue(records)

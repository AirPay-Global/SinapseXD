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
    #: Lakehouse pillar tag for Bronze partitioning, e.g. "ais".
    pillar: str = "unknown"
    #: Provider/source tag for Bronze partitioning, e.g. "portwatch".
    source: str = "unknown"

    #: Optional Bronze lake + lineage catalog; injected or built from env.
    bronze = None      # type: ignore[assignment]
    lineage = None     # type: ignore[assignment]

    @abstractmethod
    def fetch(self) -> list[dict]:
        """Pull raw records from the external API."""

    @abstractmethod
    def normalise(self, raw: dict) -> dict:
        """Map a raw record to the Sinapse XD schema (UTC timestamps)."""

    def land_raw(self, raw: list[dict]) -> str | None:
        """Write the raw batch to Bronze (immutable Parquet) and index its
        lineage. Returns the lineageRef, or None when Bronze isn't configured
        (dev/demo) or the landing failed — the pipeline still runs and enqueues
        to Silver either way, just without raw retention for that batch.

        Raw retention is an enrichment for replayability, not a precondition
        for the dashboards to get data: a Storage misconfiguration (e.g. the
        sinapse-bronze bucket not created yet → HTTP 400) must not block the
        Silver/Gold path. It's logged loudly so the operator fixes the bucket,
        but ingestion continues."""
        if not self.bronze:
            return None
        try:
            landing = self.bronze.land(self.pillar, self.source, raw)
        except Exception:
            logger.exception(
                "Could not land raw batch to Bronze — continuing without raw "
                "retention/lineage for this batch. If this is a 400/404, create "
                "the '%s' Supabase Storage bucket (SUPABASE_STORAGE_BUCKET_RAW).",
                os.environ.get("SUPABASE_STORAGE_BUCKET_RAW", "sinapse-bronze"),
            )
            return None
        if self.lineage:
            try:
                self.lineage.record(landing)
            except Exception:
                logger.exception("Landed to Bronze but could not index lineage — continuing.")
        logger.info("landed %d raw records to Bronze: %s", landing.row_count, landing.ref)
        return landing.ref

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

    def _configure_lake(self) -> None:
        """Build Bronze + lineage from env when not already injected (tests
        inject their own doubles, so those win and this is a no-op). A bad or
        unreachable DATABASE_URL must not crash the whole ingestor run before
        it even gets to fetch() — lineage recording is an enrichment, not a
        precondition, so this degrades to "no lineage catalog" and logs,
        rather than raising."""
        if self.bronze is None:
            from lake import bronze_from_env

            self.bronze = bronze_from_env()
        if self.bronze is not None and self.lineage is None:
            dsn = os.environ.get("DATABASE_URL")
            if dsn:
                import psycopg

                from lake import LineageCatalog

                try:
                    # prepare_threshold=None keeps this working under Supabase's
                    # transaction-mode pooler (PgBouncer); use the pooler host, not
                    # the IPv6-only direct host. See silver_consumer for the full note.
                    self.lineage = LineageCatalog(psycopg.connect(dsn, prepare_threshold=None))
                except Exception:
                    logger.exception(
                        "Could not connect DATABASE_URL for the lineage catalog — "
                        "continuing without lineage recording. Use the Supabase pooler "
                        "host (aws-0-<region>.pooler.supabase.com), not the direct "
                        "db.<ref>.supabase.co host (IPv6-only, unreachable from Render)."
                    )

    def run(self) -> None:
        self._configure_lake()
        raw = self.fetch()
        if not raw:
            return
        # Bronze first — raw is retained before any transform, so Silver is
        # always replayable and each record carries a lineageRef.
        lineage_ref = self.land_raw(raw)
        records = []
        for r in raw:
            rec = self.normalise(r)
            if lineage_ref is not None:
                rec["lineageRef"] = lineage_ref
            records.append(rec)
        # Idempotency: normalise() must emit a stable natural key per record
        # (e.g. imo+timestamp) so re-runs upsert rather than duplicate.
        self.enqueue(records)

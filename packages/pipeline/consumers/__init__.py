"""Silver-layer queue consumers.

Drain normalised records off the BullMQ/Upstash queues the ingestors produce
and upsert them into the Supabase Postgres Silver tables — idempotently and
ontology-keyed (Master Build Plan v2 §0.3). One handler per queue; adding a
pillar is a new handler entry, not a new worker.
"""
from .silver_consumer import SilverConsumer

__all__ = ["SilverConsumer"]

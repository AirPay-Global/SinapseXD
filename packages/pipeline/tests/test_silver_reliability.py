"""Silver consumer reliability tests — no database required.

Exercises the failure/recovery guarantees directly (a fake Postgres
connection whose commit/rollback are just counters, and a handler that fails
on command) so these run in every environment, unlike the DB-integration
tests in test_silver_consumer.py which need TEST_DATABASE_URL. This is
deliberate: reliability under failure is exactly the property that must not
silently go untested just because a real database isn't available.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import fakeredis
import pytest

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))

from consumers.silver_consumer import MAX_ATTEMPTS, SilverConsumer  # noqa: E402


class _FakeConn:
    """Stand-in psycopg connection: execute() is a no-op unless armed to
    raise; commit/rollback just count calls."""

    def __init__(self):
        self.commits = 0
        self.rollbacks = 0
        self._raise_next = False

    def execute(self, *a, **k):
        if self._raise_next:
            raise RuntimeError("simulated handler failure")

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def fail_next(self):
        self._raise_next = True

    def succeed_next(self):
        self._raise_next = False


QUEUE = "port.activity.daily"  # a real, handled queue name


def _enqueue(redis_client, queue: str, data: dict, attempts: int | None = None) -> None:
    job = {"name": queue, "data": data, "ts": "2026-07-08T00:00:00Z"}
    if attempts is not None:
        job["attempts"] = attempts
    redis_client.lpush(f"bull:{queue}:wait", json.dumps(job))


def test_failed_job_is_not_lost_it_is_requeued():
    """A handler failure must not make the job vanish — it goes back onto
    `wait` for retry, not into the void a bare RPOP would leave it in."""
    redis_client = fakeredis.FakeStrictRedis()
    conn = _FakeConn()
    _enqueue(redis_client, QUEUE, {"portId": "p1"})

    conn.fail_next()
    consumer = SilverConsumer(redis_client, conn, queues=[QUEUE])
    processed = consumer.drain_once()

    assert processed == 0
    assert conn.rollbacks == 1
    # Requeued onto wait, not dropped.
    assert redis_client.llen(f"bull:{QUEUE}:wait") == 1
    # Not left stuck in processing.
    assert redis_client.llen(f"bull:{QUEUE}:processing") == 0
    requeued = json.loads(redis_client.lrange(f"bull:{QUEUE}:wait", 0, 0)[0])
    assert requeued["attempts"] == 1


def test_job_exhausting_max_attempts_is_dead_lettered_not_lost():
    redis_client = fakeredis.FakeStrictRedis()
    conn = _FakeConn()
    conn.fail_next()
    _enqueue(redis_client, QUEUE, {"portId": "p1"}, attempts=MAX_ATTEMPTS - 1)

    consumer = SilverConsumer(redis_client, conn, queues=[QUEUE])
    processed = consumer.drain_once()

    assert processed == 0
    assert redis_client.llen(f"bull:{QUEUE}:wait") == 0  # not requeued again
    assert redis_client.llen(f"bull:{QUEUE}:processing") == 0  # not stuck
    dead = redis_client.lrange(f"bull:{QUEUE}:dead", 0, -1)
    assert len(dead) == 1
    assert json.loads(dead[0])["attempts"] == MAX_ATTEMPTS


def test_successful_job_is_removed_from_processing_and_wait():
    redis_client = fakeredis.FakeStrictRedis()
    conn = _FakeConn()
    _enqueue(redis_client, QUEUE, {"portId": "p1"})

    consumer = SilverConsumer(redis_client, conn, queues=[QUEUE])
    processed = consumer.drain_once()

    assert processed == 1
    assert conn.commits == 1
    assert redis_client.llen(f"bull:{QUEUE}:wait") == 0
    assert redis_client.llen(f"bull:{QUEUE}:processing") == 0


def test_malformed_json_is_dead_lettered_not_lost_and_not_retried_forever():
    redis_client = fakeredis.FakeStrictRedis()
    conn = _FakeConn()
    redis_client.lpush(f"bull:{QUEUE}:wait", "not valid json{{{")

    consumer = SilverConsumer(redis_client, conn, queues=[QUEUE])
    processed = consumer.drain_once()

    assert processed == 0
    assert redis_client.llen(f"bull:{QUEUE}:wait") == 0
    assert redis_client.llen(f"bull:{QUEUE}:dead") == 1


def test_recover_stale_reclaims_jobs_orphaned_mid_process():
    """Simulates a worker that crashed between the LMOVE (wait->processing)
    and the commit: the job is sitting in `processing` with nothing in
    `wait`. A fresh consumer's startup recovery must bring it back."""
    redis_client = fakeredis.FakeStrictRedis()
    conn = _FakeConn()
    orphan = json.dumps({"name": QUEUE, "data": {"portId": "orphan"}, "ts": "x"})
    redis_client.lpush(f"bull:{QUEUE}:processing", orphan)
    assert redis_client.llen(f"bull:{QUEUE}:wait") == 0

    consumer = SilverConsumer(redis_client, conn, queues=[QUEUE])
    recovered = consumer.recover_stale()

    assert recovered == 1
    assert redis_client.llen(f"bull:{QUEUE}:processing") == 0
    assert redis_client.llen(f"bull:{QUEUE}:wait") == 1

    # And it's now processable normally.
    processed = consumer.drain_once()
    assert processed == 1
    assert conn.commits == 1


def test_unhandled_queue_name_is_dead_lettered_not_dropped_silently():
    redis_client = fakeredis.FakeStrictRedis()
    conn = _FakeConn()
    unhandled = "nonexistent.queue"
    _enqueue(redis_client, unhandled, {"x": 1})

    consumer = SilverConsumer(redis_client, conn, queues=[unhandled])
    processed = consumer.drain_once()

    assert processed == 0
    assert redis_client.llen(f"bull:{unhandled}:dead") == 1

"""Inspect and replay dead-lettered pipeline jobs.

A job lands in `bull:<queue>:dead` after MAX_ATTEMPTS failed handler runs.
Nothing reads that list, so dead letters accumulate silently and the records
never reach Postgres. This makes them inspectable, and replayable once the
cause is fixed.

    python -m deadletters                    # summarise every queue
    python -m deadletters --show <queue>     # sample payloads from one queue
    python -m deadletters --replay <queue>   # move them back onto `wait`
    python -m deadletters --purge <queue>    # discard them (asks first)

The enqueue timestamp on each job is the useful bit: it distinguishes a
historical batch that failed during a since-fixed outage from jobs still
failing now. Compare the newest dead letter against when the cause was
fixed — if nothing is newer, the problem is behind you and a replay is all
that's needed.

Replay is safe to run more than once: every Silver handler is an idempotent
upsert keyed on its natural key, so a record arriving twice updates in place
rather than duplicating. That is why replay reads the whole list, pushes it
onto `wait`, and only then clears `dead` — biased toward duplicating a job
rather than losing one, since duplication costs nothing here.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter

from consumers.handlers import HANDLERS


def _client():
    url = os.environ.get("UPSTASH_REDIS_URL")
    if not url:
        print("UPSTASH_REDIS_URL is not set.", file=sys.stderr)
        sys.exit(1)
    import redis

    try:
        c = redis.from_url(url)
        c.ping()
        return c
    except Exception as exc:
        print(f"Redis unreachable: {exc}", file=sys.stderr)
        sys.exit(1)


def _decode(raw) -> dict | None:
    if isinstance(raw, bytes):
        raw = raw.decode(errors="replace")
    try:
        return json.loads(raw)
    except Exception:
        return None


def _summarise(client, queues: list[str]) -> None:
    print(f"{'QUEUE':<28} {'DEAD':>6}  {'OLDEST':<26} {'NEWEST'}")
    print("-" * 92)
    total = 0
    for q in queues:
        items = client.lrange(f"bull:{q}:dead", 0, -1)
        if not items:
            continue
        total += len(items)
        stamps = sorted(
            s for s in (
                (_decode(i) or {}).get("ts") for i in items
            ) if s
        )
        oldest = stamps[0][:19] if stamps else "?"
        newest = stamps[-1][:19] if stamps else "?"
        print(f"{q:<28} {len(items):>6}  {oldest:<26} {newest}")
    if not total:
        print("(none)")
        return
    print(f"\n{total} dead-lettered job(s) total.")
    print(
        "If a queue's NEWEST timestamp predates the fix for whatever was breaking\n"
        "it, those jobs are historical — replay them. If it is recent, the cause\n"
        "is still live and replaying will just re-fill the dead list."
    )


def _show(client, queue: str, limit: int = 3) -> None:
    items = client.lrange(f"bull:{queue}:dead", 0, limit - 1)
    if not items:
        print(f"No dead letters on {queue}.")
        return
    errors = Counter()
    for raw in client.lrange(f"bull:{queue}:dead", 0, -1):
        errors[(_decode(raw) or {}).get("lastError", "(unparseable)")] += 1
    print(f"Recorded errors on {queue}:")
    for err, n in errors.most_common():
        print(f"  {n:>6}  {err}")
    print(f"\nFirst {len(items)} payload(s):")
    for raw in items:
        job = _decode(raw)
        if job is None:
            print("  (unparseable JSON)")
            continue
        print(f"  ts={job.get('ts')}  attempts={job.get('attempts')}")
        print(f"    data={json.dumps(job.get('data'), default=str)[:300]}")


def _diagnose(client, queue: str, sample: int = 3) -> None:
    """Run dead-lettered payloads through their real handler against the real
    schema, inside a transaction that is always rolled back. Reproduces the
    actual exception now, rather than relying on a worker log that has since
    rolled off — which is the whole reason a backlog can sit here
    unexplained. Writes nothing."""
    items = client.lrange(f"bull:{queue}:dead", 0, sample - 1)
    if not items:
        print(f"No dead letters on {queue}.")
        return
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set — cannot reproduce handler failures.", file=sys.stderr)
        sys.exit(1)
    import psycopg

    handler = HANDLERS.get(queue)
    if handler is None:
        print(f"No handler registered for {queue}.", file=sys.stderr)
        sys.exit(1)
    conn = psycopg.connect(url, prepare_threshold=None)
    print(f"Replaying {len(items)} payload(s) from {queue} against the live schema "
          f"(rolled back, nothing written):\n")
    for raw in items:
        job = _decode(raw)
        if job is None:
            print("  (unparseable JSON)\n")
            continue
        record = job.get("data", job)
        print(f"  ts={job.get('ts')}")
        print(f"  data={json.dumps(record, default=str)[:240]}")
        succeeded = False
        try:
            with conn.transaction():
                handler(conn, record)
                succeeded = True
                # psycopg swallows Rollback raised inside the block: it undoes
                # the work and resumes after the `with`. This is how a
                # diagnostic run stays read-only even when the handler works.
                raise psycopg.Rollback
        except Exception as exc:
            succeeded = False
            print(f"  -> STILL FAILS: {type(exc).__name__}: {exc}\n")
            conn.rollback()
        if succeeded:
            print("  -> SUCCEEDS now (original cause is fixed; safe to replay)\n")


def _replay(client, queue: str) -> None:
    dead_key, wait_key = f"bull:{queue}:dead", f"bull:{queue}:wait"
    items = client.lrange(dead_key, 0, -1)
    if not items:
        print(f"No dead letters on {queue}.")
        return
    requeued = 0
    for raw in items:
        job = _decode(raw)
        if job is None:
            continue  # leave unparseable entries in `dead` for inspection
        job.pop("attempts", None)   # fresh attempt budget
        job.pop("lastError", None)
        client.lpush(wait_key, json.dumps(job))
        requeued += 1
    # Only clear `dead` once everything is safely on `wait`. Handlers are
    # idempotent upserts, so a duplicate costs nothing; a lost record does.
    client.ltrim(dead_key, len(items), -1)
    print(f"Replayed {requeued} job(s) from {queue} back onto `wait`.")
    unparseable = len(items) - requeued
    if unparseable:
        print(f"{unparseable} unparseable entry/entries left in `dead` for inspection.")
    print("The Silver consumer will drain them on its next poll — watch `python -m status`.")


def _purge(client, queue: str) -> None:
    dead_key = f"bull:{queue}:dead"
    n = client.llen(dead_key)
    if not n:
        print(f"No dead letters on {queue}.")
        return
    reply = input(f"Permanently discard {n} dead-lettered job(s) on {queue}? [y/N] ")
    if reply.strip().lower() != "y":
        print("Aborted.")
        return
    client.delete(dead_key)
    print(f"Discarded {n} job(s).")


def main() -> None:
    p = argparse.ArgumentParser(description="Inspect and replay dead-lettered jobs.")
    p.add_argument("--show", metavar="QUEUE", help="sample payloads and error counts")
    p.add_argument("--diagnose", metavar="QUEUE",
                   help="re-run sample payloads against the live schema (rolled back) "
                        "to see whether they still fail, and why")
    p.add_argument("--replay", metavar="QUEUE", help="move dead letters back onto `wait`")
    p.add_argument("--purge", metavar="QUEUE", help="permanently discard them (asks first)")
    args = p.parse_args()

    queues = list(HANDLERS.keys())
    client = _client()

    for flag, name in (("show", args.show), ("replay", args.replay),
                       ("purge", args.purge), ("diagnose", args.diagnose)):
        if name and name not in queues:
            print(f"Unknown queue {name!r}. Known: {', '.join(queues)}", file=sys.stderr)
            sys.exit(1)

    if args.show:
        _show(client, args.show)
    elif args.diagnose:
        _diagnose(client, args.diagnose)
    elif args.replay:
        _replay(client, args.replay)
    elif args.purge:
        _purge(client, args.purge)
    else:
        _summarise(client, queues)


if __name__ == "__main__":
    main()

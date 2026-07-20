"""Bronze zone — immutable raw landing (Master Build Plan v2 §0.3).

Every ingestor fetch is written here, exactly as received, as Parquet before
any transform — so Silver is always replayable and every value has a
`lineageRef` pointing at its raw source object.

Storage is pluggable: LocalBronzeStore for dev/tests, SupabaseBronzeStore
(S3-compatible Supabase Storage) for production. The object key is
self-describing and partitioned: `pillar/source/date=YYYY-MM-DD/<ts>-<sha8>.parquet`.
"""
from __future__ import annotations

import hashlib
import io
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

import pyarrow as pa
import pyarrow.parquet as pq


@dataclass(frozen=True)
class Landing:
    """Result of landing one batch — the lineage record."""
    ref: str          # storage key, used as the evidence lineageRef
    pillar: str
    source: str
    row_count: int
    sha256: str
    size_bytes: int
    landed_at: str


def _to_parquet(records: list[dict]) -> bytes:
    table = pa.Table.from_pylist(records)
    buf = io.BytesIO()
    pq.write_table(table, buf, compression="snappy")
    return buf.getvalue()


def _key(pillar: str, source: str, when: datetime, sha8: str) -> str:
    # Date-partitioned, but NOT Hive-style ("date=YYYY-MM-DD"): Supabase Storage
    # validates object keys against S3-safe characters, and "=" is not in that
    # set — a Hive key is rejected with a 400 "Invalid key". A plain date path
    # segment keeps the partitioning without the offending character.
    day = when.strftime("%Y-%m-%d")
    stamp = when.strftime("%Y%m%dT%H%M%SZ")
    return f"{pillar}/{source}/{day}/{stamp}-{sha8}.parquet"


class BronzeStore(Protocol):
    def put(self, key: str, data: bytes) -> None: ...


class BronzeLake:
    """Serialises a batch to Parquet and writes it to the backing store."""

    def __init__(self, store: BronzeStore):
        self.store = store

    def land(
        self, pillar: str, source: str, records: list[dict], when: datetime | None = None
    ) -> Landing:
        when = when or datetime.now(timezone.utc)
        data = _to_parquet(records)
        sha = hashlib.sha256(data).hexdigest()
        key = _key(pillar, source, when, sha[:8])
        self.store.put(key, data)
        return Landing(
            ref=key,
            pillar=pillar,
            source=source,
            row_count=len(records),
            sha256=sha,
            size_bytes=len(data),
            landed_at=when.isoformat(),
        )


class LocalBronzeStore:
    """Filesystem-backed store for dev and tests."""

    def __init__(self, root: str | Path):
        self.root = Path(root)

    def put(self, key: str, data: bytes) -> None:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


class SupabaseBronzeStore:
    """Supabase Storage (S3-compatible) via the Storage REST API."""

    def __init__(self, *, base_url: str, service_key: str, bucket: str, timeout: float = 30.0):
        self.endpoint = f"{base_url.rstrip('/')}/storage/v1/object/{bucket}"
        self.headers = {
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/octet-stream",
        }
        self.timeout = timeout

    def put(self, key: str, data: bytes) -> None:
        import httpx

        # x-upsert:false keeps the zone immutable — a re-landed identical batch
        # has the same key (content hash) and is rejected rather than rewritten.
        headers = {**self.headers, "x-upsert": "false"}
        resp = httpx.post(f"{self.endpoint}/{key}", content=data, headers=headers, timeout=self.timeout)
        if resp.status_code == 409:
            return  # already landed — immutable, nothing to do
        if resp.status_code >= 400:
            # Surface Supabase's actual reason (invalid key, missing bucket,
            # auth, size limit) — raise_for_status alone hides the response
            # body, which is where Storage puts the real diagnosis.
            raise RuntimeError(
                f"Supabase Storage upload failed ({resp.status_code}) for key '{key}': {resp.text[:500]}"
            )


def bronze_from_env() -> BronzeLake | None:
    """Build the production Bronze lake from env, or None when unconfigured
    (ingestors then skip landing — dashboards still run on demo data)."""
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    # SUPABASE_SECRET_KEY is Supabase's current name for the elevated server
    # key; SUPABASE_SERVICE_ROLE_KEY is kept as a fallback for older projects
    # still on the legacy key naming.
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    bucket = os.environ.get("SUPABASE_STORAGE_BUCKET_RAW", "sinapse-bronze")
    if not (url and key):
        return None
    return BronzeLake(SupabaseBronzeStore(base_url=url, service_key=key, bucket=bucket))

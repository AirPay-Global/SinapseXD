"""Lineage catalog — an index of every Bronze object landed.

Records provenance for each raw batch (pillar, source, storage key, row count,
checksum) so a Silver/Gold value's lineageRef resolves to a catalogued,
checksummed raw object (Principle #7: every insight is traceable). Optional:
when no Postgres connection is configured the ingestor still lands to Bronze;
it just doesn't index — the self-describing object key remains the lineageRef.
"""
from __future__ import annotations

from .bronze import Landing


class LineageCatalog:
    def __init__(self, pg_conn):
        self.conn = pg_conn

    def record(self, landing: Landing) -> None:
        self.conn.execute(
            """
            insert into bronze_objects (
              ref, pillar, source, row_count, sha256, size_bytes, landed_at
            ) values (
              %(ref)s, %(pillar)s, %(source)s, %(row_count)s, %(sha256)s,
              %(size_bytes)s, %(landed_at)s
            )
            on conflict (ref) do nothing
            """,
            {
                "ref": landing.ref,
                "pillar": landing.pillar,
                "source": landing.source,
                "row_count": landing.row_count,
                "sha256": landing.sha256,
                "size_bytes": landing.size_bytes,
                "landed_at": landing.landed_at,
            },
        )
        self.conn.commit()

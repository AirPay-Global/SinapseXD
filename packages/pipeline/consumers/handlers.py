"""Per-queue Silver upsert handlers.

Each handler takes a psycopg connection and one normalised record (the `data`
payload an ingestor enqueued) and performs an idempotent upsert into the
matching Silver table. Re-processing the same record is a no-op beyond
refreshing the evidence timestamp — safe for at-least-once delivery.
"""
from __future__ import annotations

import json
from typing import Callable

from psycopg import Connection

from ontology import resolve_country

Handler = Callable[[Connection, dict], None]


def _jsonb(value: object) -> str:
    return json.dumps(value or {})


def handle_port_activity(conn: Connection, rec: dict) -> None:
    """Upsert an IMF PortWatch daily port-activity record.

    Idempotency key: (source, source_port_id, activity_date). Country and
    canonical port ids are resolved to ontology keys, or NULL on a miss so the
    foreign keys never reject a valid record.
    """
    country = resolve_country(rec.get("iso3"))
    conn.execute(
        """
        insert into port_activity_daily (
          source, source_port_id, canonical_port_id, country_iso3, activity_date,
          port_calls, port_calls_by_class,
          import_tons, import_by_class,
          export_tons, export_by_class,
          as_of, lineage_ref
        ) values (
          %(source)s, %(source_port_id)s, %(canonical_port_id)s, %(country_iso3)s, %(activity_date)s,
          %(port_calls)s, %(port_calls_by_class)s,
          %(import_tons)s, %(import_by_class)s,
          %(export_tons)s, %(export_by_class)s,
          now(), %(lineage_ref)s
        )
        on conflict (source, source_port_id, activity_date) do update set
          canonical_port_id   = excluded.canonical_port_id,
          country_iso3        = excluded.country_iso3,
          port_calls          = excluded.port_calls,
          port_calls_by_class = excluded.port_calls_by_class,
          import_tons         = excluded.import_tons,
          import_by_class     = excluded.import_by_class,
          export_tons         = excluded.export_tons,
          export_by_class     = excluded.export_by_class,
          as_of               = now(),
          lineage_ref         = excluded.lineage_ref
        """,
        {
            "source": rec.get("source", "portwatch"),
            "source_port_id": rec.get("portId", ""),
            "canonical_port_id": rec.get("canonicalPortId"),
            "country_iso3": country,
            "activity_date": rec.get("dateIso") or None,
            "port_calls": int(rec.get("portCalls", 0) or 0),
            "port_calls_by_class": _jsonb(rec.get("portCallsByClass")),
            "import_tons": rec.get("importTons", 0) or 0,
            "import_by_class": _jsonb(rec.get("importByClass")),
            "export_tons": rec.get("exportTons", 0) or 0,
            "export_by_class": _jsonb(rec.get("exportByClass")),
            "lineage_ref": rec.get("lineageRef"),
        },
    )


# queue name → handler
HANDLERS: dict[str, Handler] = {
    "port.activity.daily": handle_port_activity,
}

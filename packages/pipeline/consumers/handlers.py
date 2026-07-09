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

from ontology import resolve_country, resolve_port

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


def handle_vessel_position(conn: Connection, rec: dict) -> None:
    """Upsert an AIS vessel-position report.

    Idempotency key: (mmsi, ts) — AIS always carries MMSI; IMO is often blank
    so it can't anchor the key. Destination is resolved to a canonical port
    id where the crosswalk has a match; the raw string is always kept too so
    nothing is lost on a resolver miss.
    """
    mmsi = str(rec.get("mmsi") or "").strip()
    ts = rec.get("tsIso")
    if not mmsi or not ts:
        return
    dest_raw = rec.get("destinationPort") or ""
    dest_port_id = resolve_port("ais", native_id=dest_raw) if dest_raw else None
    conn.execute(
        """
        insert into vessel_positions (
          mmsi, imo, name, vessel_type, ts, lat, lng, speed_kn, heading, status,
          destination_port_id, destination_raw, eta, source, lineage_ref
        ) values (
          %(mmsi)s, nullif(%(imo)s, ''), nullif(%(name)s, ''), %(vessel_type)s, %(ts)s,
          %(lat)s, %(lng)s, %(speed_kn)s, %(heading)s, %(status)s,
          %(dest_port_id)s, %(dest_raw)s,
          nullif(%(eta)s, '')::timestamptz, %(source)s, %(lineage_ref)s
        )
        on conflict (mmsi, ts) do update set
          imo                  = excluded.imo,
          name                 = excluded.name,
          vessel_type          = excluded.vessel_type,
          lat                  = excluded.lat,
          lng                  = excluded.lng,
          speed_kn             = excluded.speed_kn,
          heading              = excluded.heading,
          status               = excluded.status,
          destination_port_id  = excluded.destination_port_id,
          destination_raw      = excluded.destination_raw,
          eta                  = excluded.eta,
          lineage_ref          = excluded.lineage_ref
        """,
        {
            "mmsi": mmsi,
            "imo": rec.get("imo") or "",
            "name": rec.get("name") or "",
            "vessel_type": rec.get("type"),
            "ts": ts,
            "lat": rec.get("lat", 0.0),
            "lng": rec.get("lng", 0.0),
            "speed_kn": rec.get("speedKn"),
            "heading": rec.get("heading"),
            "status": rec.get("status"),
            "dest_port_id": dest_port_id,
            "dest_raw": dest_raw,
            "eta": rec.get("etaIso") or "",
            "source": rec.get("source", "ais"),
            "lineage_ref": rec.get("lineageRef"),
        },
    )


def handle_trade_flow(conn: Connection, rec: dict) -> None:
    """Upsert a UN Comtrade bilateral trade-flow record.

    Idempotency key: (reporter_iso3, partner_iso3, flow_code, cmd_code,
    period, source). Rows with an unresolvable country (outside our pilot +
    corridor-partner registry) are dropped rather than inserted with a
    dangling FK.
    """
    reporter = resolve_country(rec.get("reporterIso3"))
    partner = resolve_country(rec.get("partnerIso3"))
    if not reporter or not partner or not rec.get("period"):
        return
    conn.execute(
        """
        insert into trade_flows (
          reporter_iso3, partner_iso3, flow_code, cmd_code, period,
          trade_value_usd, net_weight_kg, source, as_of, lineage_ref
        ) values (
          %(reporter)s, %(partner)s, %(flow_code)s, %(cmd_code)s, %(period)s,
          %(trade_value_usd)s, %(net_weight_kg)s, %(source)s, now(), %(lineage_ref)s
        )
        on conflict (reporter_iso3, partner_iso3, flow_code, cmd_code, period, source) do update set
          trade_value_usd = excluded.trade_value_usd,
          net_weight_kg   = excluded.net_weight_kg,
          as_of           = now(),
          lineage_ref     = excluded.lineage_ref
        """,
        {
            "reporter": reporter,
            "partner": partner,
            "flow_code": rec.get("flowCode", ""),
            "cmd_code": rec.get("cmdCode", "TOTAL"),
            "period": rec.get("period"),
            "trade_value_usd": rec.get("tradeValueUsd", 0) or 0,
            "net_weight_kg": rec.get("netWeightKg", 0) or 0,
            "source": rec.get("source", "comtrade"),
            "lineage_ref": rec.get("lineageRef"),
        },
    )


def handle_marine_conditions(conn: Connection, rec: dict) -> None:
    """Upsert an Open-Meteo marine-conditions reading.

    Idempotency key: (ont_port_id, ts). Records for a port outside the
    ont_port registry are dropped — the pilot registry is the ingestor's own
    fixed list, so this should never happen in practice, but a bad env
    override must not crash the consumer.
    """
    port_id = str(rec.get("portId") or "").strip()
    ts = rec.get("tsIso")
    if not port_id or not ts:
        return
    conn.execute(
        """
        insert into marine_conditions (
          ont_port_id, ts, wave_height_m, wind_speed_kn, disruption_risk, source
        ) values (
          %(port_id)s, %(ts)s, %(wave_height_m)s, %(wind_speed_kn)s, %(disruption_risk)s, %(source)s
        )
        on conflict (ont_port_id, ts) do update set
          wave_height_m   = excluded.wave_height_m,
          wind_speed_kn   = excluded.wind_speed_kn,
          disruption_risk = excluded.disruption_risk
        """,
        {
            "port_id": port_id,
            "ts": ts,
            "wave_height_m": rec.get("waveHeightM", 0) or 0,
            "wind_speed_kn": rec.get("windSpeedKn", 0) or 0,
            "disruption_risk": rec.get("disruptionRisk"),
            "source": rec.get("source", "open-meteo"),
        },
    )


# queue name → handler
HANDLERS: dict[str, Handler] = {
    "port.activity.daily": handle_port_activity,
    "ais.vessel.positions": handle_vessel_position,
    "trade.corridor.flows": handle_trade_flow,
    "weather.marine.forecast": handle_marine_conditions,
}

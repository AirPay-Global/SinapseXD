"""AISStream.io provider — free, key-required, WebSocket AIS feed.

BUILD PROVENANCE: verified against AISStream's published documentation
(supplied by the account owner, since aisstream.io is blocked by this
environment's network egress). URL, subscription shape, message envelope
and the PositionReport/ShipStaticData field names below all come from
their documented examples rather than from general knowledge.

CAVEAT: AISStream is explicitly in BETA — "we make no guarantees and
provide no SLA", and "our api and object models are currently NOT stable".
Treat it as a stopgap while a commercial AIS feed is sorted out, and
re-run --probe after any unexplained drop in vessel counts, since the
models can change under us.

Protocol:
  wss://stream.aisstream.io/v0/stream
  On connect, send a subscription within ~3 seconds or the server closes:
      {"APIKey": "...", "BoundingBoxes": [[[lat_min, lon_min], [lat_max, lon_max]]]}
  NOTE the coordinate order: AISStream takes [latitude, longitude] pairs,
  the OPPOSITE of GeoJSON/Kpler's (longitude, latitude). Getting this
  backwards silently yields an empty stream rather than an error, so the
  bbox conversion below is deliberately explicit.
  Messages arrive as:
      {"MessageType": "PositionReport",
       "MetaData": {"MMSI": int, "ShipName": str, "latitude": float,
                    "longitude": float, "time_utc": "..."},
       "Message": {"PositionReport": {...}}}
  The docs spell the metadata key BOTH ways — "Metadata" in the message
  format description, "MetaData" in the worked example — so _meta_of()
  accepts either rather than betting on one.
  Two message types matter here and they carry disjoint information:
    PositionReport  — position, Sog, Cog, TrueHeading, NavigationalStatus
    ShipStaticData  — Name, ImoNumber, Type, Destination, Eta
  So a usable vessel record requires merging both, keyed on MMSI — which is
  what _collect() does. We subscribe with FilterMessageTypes limited to
  those two: the docs warn that a consumer falling behind gets disconnected
  (~300 msg/s for a worldwide subscription), and the other ~20 types are
  base stations, safety broadcasts and binary payloads we do not model.
  This also means only Class A vessels are captured — commercial shipping,
  which is the subject of this product; Class B (leisure/small craft) uses
  StandardClassBPositionReport and can be added later if wanted.

  Errors arrive as ordinary messages: {"error": "Api Key Is Not Valid"}.
  These are surfaced loudly rather than skipped — an unnoticed bad key
  otherwise looks exactly like "no vessels in this area".

Why a streaming source is polled in windows: BaseIngestor's contract is
fetch() -> normalise() -> enqueue(), driven by poll_forever() on an
interval. Rather than diverge from that (and lose Bronze landing and the
queue semantics every other pillar shares), fetch() opens a connection,
accumulates for AISSTREAM_COLLECT_SECONDS, closes, and returns the merged
batch. One connection per poll cycle, no persistent socket to supervise.
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

WS_URL = "wss://stream.aisstream.io/v0/stream"

DEFAULT_COLLECT_SECONDS = 30.0

# Same ITU-R AIS vocabularies as the sibling providers.
_NAVSTAT_TO_STATUS: dict[int, str] = {
    0: "underway", 1: "at_anchor", 2: "underway", 3: "underway",
    4: "underway", 5: "moored", 6: "delayed", 7: "underway", 8: "underway",
}


def _to_int(value: object, default: int = 0) -> int:
    try:
        return int(float(value))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _to_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _clean_text(value: object) -> str:
    """AIS pads fixed-width text fields with '@' — the docs' own example
    shows Destination as "COASTGUARD@@@@@@@@H". Strip the padding so a berth
    board doesn't render a wall of at-signs. The trailing "H" in that
    example is real data, so only '@' is stripped, not everything after the
    first one."""
    return str(value or "").replace("@", "").strip()


def _meta_of(msg: dict) -> dict:
    """AISStream's docs use both "MetaData" and "Metadata". Accept either."""
    meta = msg.get("MetaData")
    if not isinstance(meta, dict):
        meta = msg.get("Metadata")
    return meta if isinstance(meta, dict) else {}


def _ship_type_label(code: int) -> str:
    """AIS ship-type code -> label. Mirrors aishub.py's mapping so the same
    vessel reads the same way regardless of which provider supplied it."""
    if 60 <= code <= 69:
        return "Passenger"
    if 70 <= code <= 79:
        return "Cargo"
    if 80 <= code <= 89:
        return "Tanker"
    if 40 <= code <= 49:
        return "High-speed craft"
    if code == 30:
        return "Fishing"
    if code in (31, 32, 52):
        return "Tug"
    if code == 35:
        return "Military"
    if code == 36:
        return "Sailing"
    if code == 37:
        return "Pleasure craft"
    if code == 50:
        return "Pilot vessel"
    if code == 51:
        return "Search and rescue"
    if code == 53:
        return "Port tender"
    if code == 55:
        return "Law enforcement"
    return "Other"


def _parse_eta(eta: object, now: datetime | None = None) -> str:
    """AISStream reports ETA as an object {Month, Day, Hour, Minute} with no
    year — the same year-inference problem as raw AIS ETA elsewhere in this
    package. Returns ISO-8601 UTC, or "" when absent/unusable (month 0 and
    day 0 are the AIS "not available" encoding)."""
    if not isinstance(eta, dict):
        return ""
    now = now or datetime.now(timezone.utc)
    month, day = _to_int(eta.get("Month")), _to_int(eta.get("Day"))
    hour, minute = _to_int(eta.get("Hour")), _to_int(eta.get("Minute"))
    if not (1 <= month <= 12 and 1 <= day <= 31 and hour <= 23 and minute <= 59):
        return ""
    try:
        parsed = datetime(now.year, month, day, hour, minute, tzinfo=timezone.utc)
    except ValueError:
        return ""
    # An ETA well in the past almost certainly means next year's date.
    if (now - parsed).days > 31:
        try:
            parsed = parsed.replace(year=now.year + 1)
        except ValueError:
            return ""
    return parsed.isoformat()


def _parse_time(raw: object, now: datetime | None = None) -> str:
    """MetaData.time_utc is a Go time.String(), e.g.
    "2026-08-13 10:04:22.123456789 +0000 UTC" — not ISO-8601, so
    datetime.fromisoformat cannot take it directly. Falls back to ingest
    time so every record still has a partition key."""
    now = now or datetime.now(timezone.utc)
    text = str(raw or "").strip()
    if text:
        cleaned = text.replace(" UTC", "").strip()
        # Trim Go's nanosecond precision to microseconds for %f.
        for fmt in ("%Y-%m-%d %H:%M:%S.%f %z", "%Y-%m-%d %H:%M:%S %z"):
            try:
                head = cleaned
                if "." in cleaned:
                    base, rest = cleaned.split(".", 1)
                    frac, _, tz = rest.partition(" ")
                    head = f"{base}.{frac[:6]} {tz}".strip()
                return datetime.strptime(head, fmt).astimezone(timezone.utc).isoformat()
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(cleaned.replace("Z", "+00:00")).isoformat()
        except ValueError:
            pass
    return now.isoformat()


def _bbox_payload(bbox: dict[str, float]) -> list[list[list[float]]]:
    """AISStream wants [[[lat_min, lon_min], [lat_max, lon_max]]] — latitude
    first. Kept as its own function so the ordering is testable in isolation;
    reversing it produces an empty stream, not an error."""
    return [[[bbox["latmin"], bbox["lonmin"]], [bbox["latmax"], bbox["lonmax"]]]]


class AisStreamProvider:
    queue_name = "ais.vessel.positions"

    def __init__(self, api_key: str | None = None, *, collect_seconds: float | None = None):
        self.api_key = api_key or os.environ.get("AISSTREAM_API_KEY", "")
        self.collect_seconds = (
            collect_seconds
            if collect_seconds is not None
            else float(os.environ.get("AISSTREAM_COLLECT_SECONDS", DEFAULT_COLLECT_SECONDS))
        )

    def fetch(self, bbox: dict[str, float]) -> list[dict]:
        if not self.api_key:
            logger.warning("AISSTREAM_API_KEY not set; AIS ingestor idle (dashboards use demo data)")
            return []
        import websocket  # imported lazily so the module imports without the dep

        sub = {
            "APIKey": self.api_key,
            "BoundingBoxes": _bbox_payload(bbox),
            # Only the two types we model. Keeps us well inside the throughput
            # the docs require of consumers, since falling behind gets the
            # connection closed.
            "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
        }
        try:
            ws = websocket.create_connection(WS_URL, timeout=15)
        except Exception:
            logger.exception("AISStream: could not connect to %s", WS_URL)
            return []
        try:
            ws.send(json.dumps(sub))
            return self._collect(ws)
        except Exception:
            logger.exception("AISStream: stream failed mid-collection")
            return []
        finally:
            try:
                ws.close()
            except Exception:
                pass

    def _collect(self, ws) -> list[dict]:
        """Accumulate for the collection window, merging PositionReport and
        ShipStaticData per MMSI — they carry disjoint fields, and a record
        with a name but no position (or vice versa) is not useful. Only
        vessels that reported a position are returned."""
        merged: dict[str, dict] = {}
        deadline = time.monotonic() + self.collect_seconds
        while time.monotonic() < deadline:
            try:
                ws.settimeout(max(1.0, deadline - time.monotonic()))
                payload = ws.recv()
            except Exception:
                break  # timeout or closed socket ends the window normally
            if not payload:
                continue
            try:
                msg = json.loads(payload)
            except Exception:
                continue
            if not isinstance(msg, dict):
                continue
            if msg.get("error"):
                # Arrives as a normal message, e.g. {"error": "Api Key Is Not
                # Valid"}. Skipping it would leave a bad key looking exactly
                # like an empty ocean, which is how the Kpler 401 went
                # unnoticed for weeks.
                logger.error(
                    "AISStream REJECTED THE SUBSCRIPTION: %s. This will not fix itself "
                    "on retry — check AISSTREAM_API_KEY at https://aisstream.io/apikeys "
                    "(a revoked key still appears there, marked invalid).",
                    msg["error"],
                )
                return []
            meta = _meta_of(msg)
            mmsi = str(meta.get("MMSI") or "").strip()
            if not mmsi:
                continue
            entry = merged.setdefault(mmsi, {"mmsi": mmsi})
            entry["meta"] = meta
            body = msg.get("Message") or {}
            if "PositionReport" in body:
                entry["position"] = body["PositionReport"]
            if "ShipStaticData" in body:
                entry["static"] = body["ShipStaticData"]
        records = [r for r in merged.values() if "position" in r]
        logger.info(
            "AISStream: %d vessel(s) with positions from %d seen in %.0fs window",
            len(records), len(merged), self.collect_seconds,
        )
        return records

    @staticmethod
    def normalise(raw: dict) -> dict:
        meta = raw.get("meta") or {}
        pos = raw.get("position") or {}
        static = raw.get("static") or {}
        navstat = _to_int(pos.get("NavigationalStatus"), 15)
        heading = _to_int(pos.get("TrueHeading"), 511)
        if heading == 511:  # "not available" per ITU-R; fall back to course
            cog = _to_float(pos.get("Cog"), 360.0)
            heading = 0 if cog >= 360 else int(cog) % 360
        else:
            heading = heading % 360
        imo = static.get("ImoNumber")
        return {
            "mmsi": str(raw.get("mmsi") or meta.get("MMSI") or "").strip(),
            "imo": str(imo).strip() if imo else "",
            "name": _clean_text(static.get("Name") or meta.get("ShipName")),
            "type": _ship_type_label(_to_int(static.get("Type"))),
            "lat": _to_float(pos.get("Latitude", meta.get("latitude"))),
            "lng": _to_float(pos.get("Longitude", meta.get("longitude"))),
            "speedKn": _to_float(pos.get("Sog")),
            "heading": heading,
            "status": _NAVSTAT_TO_STATUS.get(navstat, "underway"),
            "destinationPort": _clean_text(static.get("Destination")),
            "etaIso": _parse_eta(static.get("Eta")),
            "tsIso": _parse_time(meta.get("time_utc")),
            "source": "aisstream",
        }


def _probe() -> None:
    """Connect to the real stream and dump raw structure, so the field-name
    assumptions above can be checked against reality from a networked
    environment. Prints nothing secret."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    def say(msg: str) -> None:
        # flush every line: this runs in a Render Shell where stdout may be
        # block-buffered, and a probe whose output appears only at exit is
        # useless for telling "hung" apart from "quietly working".
        print(msg, flush=True)

    key = os.environ.get("AISSTREAM_API_KEY", "")
    say(f"AISSTREAM_API_KEY: {'set, %d chars' % len(key) if key else '*** NOT SET ***'}")
    if not key:
        return
    import socket
    import websocket

    host = "stream.aisstream.io"
    # Check plain TCP reachability first. If egress to the host is blocked
    # this fails here in seconds with a clear error, instead of looking like
    # a WebSocket or credential problem later.
    say(f"[1/4] TCP connect to {host}:443 ...")
    t0 = time.monotonic()
    try:
        socket.create_connection((host, 443), timeout=10).close()
        say(f"      ok ({time.monotonic() - t0:.1f}s)")
    except Exception as exc:
        say(f"      FAILED: {type(exc).__name__}: {exc}")
        say("      Outbound TCP/443 to aisstream.io is blocked from this host.")
        return

    bbox = {"latmin": -35.0, "latmax": 15.0, "lonmin": -20.0, "lonmax": 52.0}
    say(f"[2/4] WebSocket handshake to {WS_URL} ...")
    t0 = time.monotonic()
    try:
        ws = websocket.create_connection(WS_URL, timeout=15)
    except Exception as exc:
        say(f"      FAILED after {time.monotonic() - t0:.1f}s: {type(exc).__name__}: {exc}")
        return
    say(f"      connected ({time.monotonic() - t0:.1f}s)")

    sub = {"APIKey": key, "BoundingBoxes": _bbox_payload(bbox)}
    say(f"[3/4] sending subscription, BoundingBoxes={_bbox_payload(bbox)} (lat first)")
    try:
        ws.send(json.dumps(sub))
    except Exception as exc:
        say(f"      FAILED: {type(exc).__name__}: {exc}")
        ws.close()
        return

    window = 20
    say(f"[4/4] listening for {window}s (quiet until a new message type arrives) ...")
    seen: dict[str, dict] = {}
    count = 0
    deadline = time.monotonic() + window
    while time.monotonic() < deadline and len(seen) < 3:
        try:
            ws.settimeout(max(1.0, deadline - time.monotonic()))
            msg = json.loads(ws.recv())
        except Exception as exc:
            say(f"      recv ended after {count} message(s): {type(exc).__name__}: {exc}")
            break
        count += 1
        if isinstance(msg, dict) and msg.get("error"):
            say(f"\nSERVER ERROR: {msg['error']}")
            say("Check the key at https://aisstream.io/apikeys — a revoked key still "
                "appears there, marked invalid.")
            ws.close()
            return
        mt = msg.get("MessageType", "?")
        if mt not in seen:
            seen[mt] = msg
            say(f"\n--- first {mt} (message #{count}) ---")
            say(json.dumps(msg, indent=2)[:1500])
    ws.close()
    say(f"\nreceived {count} message(s) in the window")
    if not seen:
        print("\nNo messages received. Check the key, and that the bbox is lat-first.")
        return
    print(f"\nMessage types seen: {', '.join(seen)}")
    sample = next(iter(seen.values()))
    print("\nnormalise() of a synthetic merge of what arrived:")
    merged = {"mmsi": str((sample.get('MetaData') or {}).get('MMSI') or ''), "meta": sample.get("MetaData") or {}}
    for m in seen.values():
        body = m.get("Message") or {}
        if "PositionReport" in body:
            merged["position"] = body["PositionReport"]
        if "ShipStaticData" in body:
            merged["static"] = body["ShipStaticData"]
    if "position" in merged:
        print(json.dumps(AisStreamProvider.normalise(merged), indent=2))
    else:
        print("(no PositionReport arrived in the window — rerun, or widen it)")


if __name__ == "__main__":
    import sys

    if "--probe" in sys.argv:
        _probe()
    else:
        print("usage: python -m ingestors.providers.aisstream --probe")

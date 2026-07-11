import "server-only";
import { cookies } from "next/headers";
import type { Corridor, Country, PillarFeed, Port, VesselPosition, VesselStatus } from "@sinapse/shared";
import { ONTOLOGY, ONTOLOGY_MARTS } from "@sinapse/shared";
import { createClient } from "@/lib/supabase/server";
import { downFeed, liveFeed } from "@/lib/feed";
import type { CorridorGateway, CorridorTradeFlow, EconomicIndicator, FreightRate, MarineConditions, PortActivity30d, SdgReading, ThroughputRow } from "./types";

/**
 * The Ontology SDK — typed, definition-driven object access over the ontology
 * (Foundry-style: query objects and links, not tables). Table/column names
 * come from the shared ONTOLOGY manifest, so there is one physical mapping and
 * the app stays ontology-first. Every read is best-effort: an unreachable or
 * empty database returns null / [] with a down feed, never throws — the caller
 * falls back to demo data.
 */

type Row = Record<string, unknown>;

function toCountry(r: Row): Country {
  return {
    id: String(r.id),
    name: String(r.name),
    iso2: String(r.iso2),
    rec: (r.rec as string) ?? null,
    isAfcftaMember: Boolean(r.is_afcfta_member),
  };
}

function toPort(r: Row): Port {
  return {
    id: String(r.id),
    name: String(r.name),
    countryId: String(r.country_iso3),
    lat: Number(r.lat),
    lng: Number(r.lng),
    unlocode: (r.unlocode as string) ?? null,
  };
}

function toCorridor(r: Row): Corridor {
  return {
    id: String(r.id),
    name: String(r.name),
    originPortId: String(r.origin_port_id),
    destinationPortId: (r.destination_port_id as string) ?? null,
    destinationName: (r.destination_name as string) ?? null,
    countryIds: (r.country_iso3s as string[]) ?? [],
  };
}

export async function createOntology() {
  // Build the client defensively — a missing/misconfigured Supabase env must
  // degrade to empty reads (demo fallback), never throw and 500 the page.
  let supabase: ReturnType<typeof createClient> | null = null;
  try {
    supabase = createClient(await cookies());
  } catch {
    supabase = null;
  }

  async function one<T>(table: string, col: string, val: string, map: (r: Row) => T): Promise<T | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from(table).select("*").eq(col, val).maybeSingle();
      return error || !data ? null : map(data as Row);
    } catch {
      return null;
    }
  }

  async function many<T>(table: string, map: (r: Row) => T, col?: string, val?: string): Promise<T[]> {
    if (!supabase) return [];
    try {
      let q = supabase.from(table).select("*");
      if (col && val !== undefined) q = q.eq(col, val);
      const { data, error } = await q;
      return error || !data ? [] : (data as Row[]).map(map);
    } catch {
      return [];
    }
  }

  const countries = {
    get: (id: string) => one(ONTOLOGY.country.table, ONTOLOGY.country.key, id, toCountry),
    list: () => many(ONTOLOGY.country.table, toCountry),
    /** Link: country → its ports (one-to-many). */
    ports: (iso3: string) =>
      many(ONTOLOGY.port.table, toPort, ONTOLOGY.country.links[0].via, iso3),

    /** Latest SDG 8/9/10/17 readings for a country (gold_sdg_latest). */
    async sdgIndicators(iso3: string): Promise<{ data: SdgReading[]; feed: PillarFeed }> {
      if (!supabase) return { data: [], feed: downFeed() };
      try {
        const { data, error } = await supabase
          .from("gold_sdg_latest")
          .select("*")
          .eq("country", iso3)
          .order("goal", { ascending: true });
        if (error || !data || data.length === 0) return { data: [], feed: downFeed() };
        return { data: data as SdgReading[], feed: liveFeed() };
      } catch {
        return { data: [], feed: downFeed() };
      }
    },

    /** Latest economic indicators for a country (gold_economic_latest). */
    async economicIndicators(iso3: string): Promise<{ data: EconomicIndicator[]; feed: PillarFeed }> {
      if (!supabase) return { data: [], feed: downFeed() };
      try {
        const { data, error } = await supabase
          .from("gold_economic_latest")
          .select("*")
          .eq("country", iso3);
        if (error || !data || data.length === 0) return { data: [], feed: downFeed() };
        return { data: data as EconomicIndicator[], feed: liveFeed() };
      } catch {
        return { data: [], feed: downFeed() };
      }
    },
  };

  /** Global freight-market benchmark (Freightos Baltic Index) — a macro
   * indicator, not a corridor- or port-specific rate. See
   * providers/freightos.py for the honest scope note. */
  const market = {
    async freightIndex(route = "global-container-composite"): Promise<{ data: FreightRate | null; feed: PillarFeed }> {
      if (!supabase) return { data: null, feed: downFeed() };
      try {
        const { data, error } = await supabase
          .from("freight_rates")
          .select("route, ts, rate_usd, index_source")
          .eq("route", route)
          .order("ts", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !data) return { data: null, feed: downFeed() };
        return { data: data as FreightRate, feed: liveFeed((data as FreightRate).ts) };
      } catch {
        return { data: null, feed: downFeed() };
      }
    },
  };

  const ports = {
    get: (id: string) => one(ONTOLOGY.port.table, ONTOLOGY.port.key, id, toPort),
    list: () => many(ONTOLOGY.port.table, toPort),
    byCountry: (iso3: string) =>
      many(ONTOLOGY.port.table, toPort, ONTOLOGY.port.links[0].via, iso3),
    /** Link: port → its country (many-to-one). */
    country: (port: Port) => countries.get(port.countryId),

    // ── Derived reads (Gold marts) ──────────────────────
    async activity30d(id: string): Promise<{ data: PortActivity30d | null; feed: PillarFeed }> {
      if (!supabase) return { data: null, feed: downFeed() };
      try {
        const { data, error } = await supabase
          .from(ONTOLOGY_MARTS.portActivity30d)
          .select("*")
          .eq("canonical_port_id", id)
          .maybeSingle();
        if (error || !data) return { data: null, feed: downFeed() };
        return { data: data as PortActivity30d, feed: liveFeed((data as PortActivity30d).as_of) };
      } catch {
        return { data: null, feed: downFeed() };
      }
    },

    async throughputMonthly(id: string): Promise<{ data: ThroughputRow[]; feed: PillarFeed }> {
      if (!supabase) return { data: [], feed: downFeed() };
      try {
        const { data, error } = await supabase
          .from(ONTOLOGY_MARTS.portThroughputMonthly)
          .select("month, vessel_class, tons")
          .eq("canonical_port_id", id)
          .order("month", { ascending: true });
        if (error || !data || data.length === 0) return { data: [], feed: downFeed() };
        return { data: data as ThroughputRow[], feed: liveFeed() };
      } catch {
        return { data: [], feed: downFeed() };
      }
    },

    /** Latest AIS position per vessel reporting this port as destination,
     * within the last `withinHours`. Falls back to demo data upstream when
     * empty — AISHub is a sparse dev feed, so "no live vessels" is common. */
    async vesselsNear(id: string, withinHours = 6): Promise<{ data: VesselPosition[]; feed: PillarFeed }> {
      if (!supabase) return { data: [], feed: downFeed() };
      try {
        const since = new Date(Date.now() - withinHours * 3600_000).toISOString();
        const { data, error } = await supabase
          .from("vessel_positions")
          .select("mmsi, imo, name, vessel_type, lat, lng, speed_kn, heading, status, destination_raw, eta, ts")
          .eq("destination_port_id", id)
          .gte("ts", since)
          .order("ts", { ascending: false })
          .limit(200);
        if (error || !data || data.length === 0) return { data: [], feed: downFeed() };
        const seen = new Set<string>();
        const vessels: VesselPosition[] = [];
        const validStatus: VesselStatus[] = ["underway", "at_anchor", "moored", "expected", "delayed"];
        for (const r of data as Row[]) {
          const mmsi = String(r.mmsi ?? "");
          if (!mmsi || seen.has(mmsi)) continue;
          seen.add(mmsi);
          const status = String(r.status ?? "underway") as VesselStatus;
          vessels.push({
            mmsi,
            imo: String(r.imo ?? ""),
            name: String(r.name ?? mmsi),
            type: String(r.vessel_type ?? "Other"),
            lat: Number(r.lat),
            lng: Number(r.lng),
            speedKn: Number(r.speed_kn ?? 0),
            heading: Number(r.heading ?? 0),
            status: validStatus.includes(status) ? status : "underway",
            destinationPort: String(r.destination_raw ?? ""),
            etaIso: (r.eta as string) ?? "",
          });
        }
        return { data: vessels, feed: liveFeed(vessels.length ? String((data as Row[])[0].ts) : undefined) };
      } catch {
        return { data: [], feed: downFeed() };
      }
    },

    /** Latest Open-Meteo marine reading for a port. */
    async conditions(id: string): Promise<{ data: MarineConditions | null; feed: PillarFeed }> {
      if (!supabase) return { data: null, feed: downFeed() };
      try {
        const { data, error } = await supabase
          .from("marine_conditions")
          .select("ont_port_id, ts, wave_height_m, wind_speed_kn, disruption_risk")
          .eq("ont_port_id", id)
          .order("ts", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !data) return { data: null, feed: downFeed() };
        return { data: data as MarineConditions, feed: liveFeed((data as MarineConditions).ts) };
      } catch {
        return { data: null, feed: downFeed() };
      }
    },
  };

  const corridors = {
    get: (id: string) => one(ONTOLOGY.corridor.table, ONTOLOGY.corridor.key, id, toCorridor),
    list: () => many(ONTOLOGY.corridor.table, toCorridor),
    /** Link: corridor → its coastal gateway (origin) port. */
    originPort: (corridor: Corridor) => ports.get(corridor.originPortId),

    async gatewayActivity(): Promise<{ data: CorridorGateway[]; feed: PillarFeed }> {
      if (!supabase) return { data: [], feed: downFeed() };
      try {
        const { data, error } = await supabase
          .from(ONTOLOGY_MARTS.corridorGatewayActivity)
          .select("*")
          .order("throughput_tons_30d", { ascending: false });
        if (error || !data || data.length === 0) return { data: [], feed: downFeed() };
        const rows = data as CorridorGateway[];
        return { data: rows, feed: liveFeed(rows[0].as_of) };
      } catch {
        return { data: [], feed: downFeed() };
      }
    },

    async tradeFlows(): Promise<{ data: CorridorTradeFlow[]; feed: PillarFeed }> {
      if (!supabase) return { data: [], feed: downFeed() };
      try {
        const { data, error } = await supabase
          .from(ONTOLOGY_MARTS.corridorTradeFlows)
          .select("*")
          .order("trade_value_usd_latest", { ascending: false });
        if (error || !data || data.length === 0) return { data: [], feed: downFeed() };
        const rows = data as CorridorTradeFlow[];
        return { data: rows, feed: liveFeed(rows[0].as_of) };
      } catch {
        return { data: [], feed: downFeed() };
      }
    },
  };

  return { countries, ports, corridors, market };
}

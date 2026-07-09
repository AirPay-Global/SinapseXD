import "server-only";
import { cookies } from "next/headers";
import type { Corridor, Country, PillarFeed, Port } from "@sinapse/shared";
import { ONTOLOGY, ONTOLOGY_MARTS } from "@sinapse/shared";
import { createClient } from "@/lib/supabase/server";
import { downFeed, liveFeed } from "@/lib/feed";
import type { CorridorGateway, PortActivity30d, ThroughputRow } from "./types";

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
  const supabase = createClient(await cookies());

  async function one<T>(table: string, col: string, val: string, map: (r: Row) => T): Promise<T | null> {
    try {
      const { data, error } = await supabase.from(table).select("*").eq(col, val).maybeSingle();
      return error || !data ? null : map(data as Row);
    } catch {
      return null;
    }
  }

  async function many<T>(table: string, map: (r: Row) => T, col?: string, val?: string): Promise<T[]> {
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
  };

  const corridors = {
    get: (id: string) => one(ONTOLOGY.corridor.table, ONTOLOGY.corridor.key, id, toCorridor),
    list: () => many(ONTOLOGY.corridor.table, toCorridor),
    /** Link: corridor → its coastal gateway (origin) port. */
    originPort: (corridor: Corridor) => ports.get(corridor.originPortId),

    async gatewayActivity(): Promise<{ data: CorridorGateway[]; feed: PillarFeed }> {
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
  };

  return { countries, ports, corridors };
}

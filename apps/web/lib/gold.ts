import { cookies } from "next/headers";
import type { PillarFeed } from "@sinapse/shared";
import { createClient } from "@/lib/supabase/server";
import { downFeed, liveFeed } from "@/lib/feed";

/**
 * Gold-mart reads for the dashboards. Each returns { data, feed }: real data
 * with a live feed when the mart has rows, or null with a down feed when the
 * database is empty/unreachable — the caller then falls back to demo data.
 * Never throws; a missing DB degrades to demo, never a broken page.
 */

export interface PortActivity30d {
  canonical_port_id: string;
  port_name: string;
  country_iso3: string;
  port_calls_30d: number;
  import_tons_30d: number;
  export_tons_30d: number;
  as_of: string;
}

export interface ThroughputRow {
  month: string;
  vessel_class: string;
  tons: number;
}

// Vessel class → label, mirroring the ont_commodity seed (0002).
export const VESSEL_CLASS_LABEL: Record<string, string> = {
  container: "Containers",
  dryBulk: "Dry bulk",
  tanker: "Tankers / liquids",
  roro: "Ro-Ro / vehicles",
  generalCargo: "General cargo",
};
const VESSEL_CLASS_ORDER = ["container", "dryBulk", "tanker", "roro", "generalCargo"];

async function client() {
  return createClient(await cookies());
}

export async function getPortActivity30d(
  canonicalPortId: string,
): Promise<{ data: PortActivity30d | null; feed: PillarFeed }> {
  try {
    const supabase = await client();
    const { data, error } = await supabase
      .from("gold_port_activity_30d")
      .select("*")
      .eq("canonical_port_id", canonicalPortId)
      .maybeSingle();
    if (error || !data) return { data: null, feed: downFeed() };
    return { data: data as PortActivity30d, feed: liveFeed((data as PortActivity30d).as_of) };
  } catch {
    return { data: null, feed: downFeed() };
  }
}

export async function getPortThroughputMonthly(
  canonicalPortId: string,
): Promise<{ data: ThroughputRow[]; feed: PillarFeed }> {
  try {
    const supabase = await client();
    const { data, error } = await supabase
      .from("gold_port_throughput_monthly")
      .select("month, vessel_class, tons")
      .eq("canonical_port_id", canonicalPortId)
      .order("month", { ascending: true });
    if (error || !data || data.length === 0) return { data: [], feed: downFeed() };
    return { data: data as ThroughputRow[], feed: liveFeed() };
  } catch {
    return { data: [], feed: downFeed() };
  }
}

/**
 * Pivot Gold throughput rows into the StackedBars shape:
 * [{ month: "2026-07", Containers: 510, "Dry bulk": 0, … }] plus the series
 * definitions (fixed class order → stable chart colours).
 */
export function pivotThroughput(rows: ThroughputRow[]): {
  data: Array<Record<string, number | string>>;
  series: Array<{ key: string; label: string }>;
} {
  const byMonth = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const month = r.month.slice(0, 7);
    const label = VESSEL_CLASS_LABEL[r.vessel_class] ?? r.vessel_class;
    const row = byMonth.get(month) ?? { month };
    row[label] = (Number(row[label]) || 0) + Number(r.tons);
    byMonth.set(month, row);
  }
  const series = VESSEL_CLASS_ORDER.map((c) => ({ key: VESSEL_CLASS_LABEL[c], label: VESSEL_CLASS_LABEL[c] }));
  return { data: [...byMonth.values()], series };
}

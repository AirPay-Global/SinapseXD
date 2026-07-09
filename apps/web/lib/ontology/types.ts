/**
 * Ontology-derived read shapes (Gold marts) and pure reshapers. No server
 * dependencies, so client views can import these types safely; the runtime
 * reads live in sdk.ts (server-only).
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

export interface CorridorGateway {
  corridor_id: string;
  corridor_name: string;
  gateway_port: string;
  port_calls_30d: number;
  throughput_tons_30d: number;
  as_of: string;
}

// Vessel class → label, mirroring the ont_commodity seed (migration 0002).
export const VESSEL_CLASS_LABEL: Record<string, string> = {
  container: "Containers",
  dryBulk: "Dry bulk",
  tanker: "Tankers / liquids",
  roro: "Ro-Ro / vehicles",
  generalCargo: "General cargo",
};
const VESSEL_CLASS_ORDER = ["container", "dryBulk", "tanker", "roro", "generalCargo"];

/**
 * Pivot Gold throughput rows into the StackedBars shape:
 * [{ month: "2026-07", Containers: 510, … }] plus fixed-order series
 * definitions (stable chart colours).
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
  const series = VESSEL_CLASS_ORDER.map((c) => ({
    key: VESSEL_CLASS_LABEL[c],
    label: VESSEL_CLASS_LABEL[c],
  }));
  return { data: [...byMonth.values()], series };
}

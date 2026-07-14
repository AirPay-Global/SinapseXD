import { quickEvidence } from "@/lib/evidence/build";
import type { EvidenceRecord } from "@/lib/evidence/types";

/**
 * Dataset / layer catalogue for the Data Visualisation Centre (spec §7, §11,
 * §20). Client-safe. Every layer maps to the canonical pilot geographies and
 * carries provenance (live/demo/planned) + an evidence record, so any mark on
 * the canvas can open its Bronze→Silver→Gold lineage. Values are grounded in
 * the platform's demo intelligence; hand-tuned so real relationships exist to
 * be discovered (e.g. congestion ↔ anchorage wait, border dwell ↔ trade share).
 */

export interface Geo {
  id: string;
  name: string;
  iso3: string;
  /** Approximate lat/lng for the SVG point map. */
  lat: number;
  lng: number;
}

export const GEOS: Geo[] = [
  { id: "durban", name: "Durban", iso3: "ZAF", lat: -29.87, lng: 31.03 },
  { id: "mombasa", name: "Mombasa", iso3: "KEN", lat: -4.06, lng: 39.65 },
  { id: "lagos", name: "Lagos", iso3: "NGA", lat: 6.44, lng: 3.36 },
  { id: "lome", name: "Lomé", iso3: "TGO", lat: 6.13, lng: 1.29 },
  { id: "djibouti", name: "Djibouti", iso3: "DJI", lat: 11.6, lng: 43.15 },
  { id: "dar", name: "Dar es Salaam", iso3: "TZA", lat: -6.82, lng: 39.29 },
  { id: "tema", name: "Tema", iso3: "GHA", lat: 5.63, lng: 0.01 },
];

export type LayerCategory = "Trade & AfCFTA" | "Ports & maritime" | "Infrastructure" | "Development finance" | "Governance" | "Climate" | "Socio-economic" | "Financial & payments";
export type UnitClass = "count" | "percent" | "index" | "usd" | "days" | "hours" | "teu" | "tons" | "score" | "ratio";

export interface Layer {
  id: string;
  name: string;
  category: LayerCategory;
  unit: string;
  unitClass: UnitClass;
  status: "live" | "demo" | "planned";
  confidence: number;
  /** Value per GEOS index; empty when planned (no data). */
  values: number[];
  /** 12-month aggregate series for temporal overlays. */
  series: number[];
  higherIsBetter: boolean;
  pillar: string;
  source: string;
  gold: string;
}

// Deterministic 12-pt series from a base level + trend.
function genSeries(base: number, trend: number, seed: number): number[] {
  let a = seed;
  const rnd = () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
  return Array.from({ length: 12 }, (_, i) => Math.round((base * (1 + trend * (i / 11)) * (0.94 + rnd() * 0.12)) * 10) / 10);
}

function L(
  id: string,
  name: string,
  category: LayerCategory,
  unit: string,
  unitClass: UnitClass,
  status: Layer["status"],
  confidence: number,
  values: number[],
  higherIsBetter: boolean,
  pillar: string,
  source: string,
  gold: string,
  trend = 0.05,
): Layer {
  const mean = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  return { id, name, category, unit, unitClass, status, confidence, values, series: values.length ? genSeries(mean, trend, id.length * 31 + values.length) : [], higherIsBetter, pillar, source, gold };
}

export const LAYERS: Layer[] = [
  // Ports & maritime
  L("port_calls", "Port calls (30d)", "Ports & maritime", "calls", "count", "live", 0.95, [409, 300, 520, 180, 240, 260, 210], true, "Port Activity", "portwatch", "gold_port_activity_30d", 0.06),
  L("throughput", "Throughput", "Ports & maritime", "k TEU", "teu", "live", 0.9, [214, 160, 280, 90, 110, 130, 100], true, "Port Activity", "portwatch", "gold_port_activity_30d", 0.05),
  L("congestion", "Congestion score", "Ports & maritime", "/100", "score", "demo", 0.74, [61, 55, 78, 40, 48, 50, 45], false, "AIS + Port Activity", "portwatch", "gold_port_congestion*", 0.08),
  L("anchorage_wait", "Anchorage wait", "Ports & maritime", "hours", "hours", "demo", 0.7, [18, 15, 26, 9, 12, 13, 10], false, "AIS + Port Activity", "portwatch", "gold_port_congestion*", 0.07),
  L("port_revenue", "Port revenue", "Financial & payments", "$M", "usd", "demo", 0.66, [42, 30, 55, 16, 22, 25, 19], true, "Financial Data", "finance", "gold_port_revenue*", 0.04),
  L("competitiveness", "Port competitiveness", "Ports & maritime", "/100", "score", "demo", 0.72, [78, 73, 62, 72, 65, 66, 75], true, "Port Activity", "portwatch", "gold_port_competitiveness*", 0.02),
  // Trade & AfCFTA
  L("trade_share", "Intra-African trade share", "Trade & AfCFTA", "%", "percent", "demo", 0.6, [16, 19, 12, 22, 14, 20, 21], true, "Trade Analytics", "comtrade", "gold_corridor_trade_flows", 0.06),
  L("border_dwell", "Border dwell time", "Trade & AfCFTA", "days", "days", "demo", 0.71, [3.1, 2.8, 4.5, 1.9, 3.4, 2.5, 2.0], false, "Trade Analytics", "trade", "gold_border_efficiency*", -0.03),
  L("corridor_throughput", "Corridor throughput", "Trade & AfCFTA", "k tons", "tons", "demo", 0.79, [280, 210, 190, 120, 150, 175, 130], true, "Trade Analytics", "portwatch", "gold_corridor_gateway_activity", 0.07),
  L("import_substitution", "Import substitution potential", "Trade & AfCFTA", "/100", "index", "demo", 0.5, [74, 61, 58, 45, 50, 55, 60], true, "Trade Analytics", "comtrade", "gold_import_substitution*", 0.03),
  // Development finance
  L("dfi_investment", "DFI investment", "Development finance", "$M", "usd", "demo", 0.7, [86, 64, 40, 30, 45, 55, 35], true, "Financial Data", "finance", "gold_dev_impact*", 0.05),
  L("dev_impact", "Development impact", "Development finance", "/100", "score", "demo", 0.77, [82, 74, 60, 55, 63, 70, 61], true, "Financial Data", "pmis", "gold_dev_impact*", 0.04),
  L("investment_readiness", "Investment readiness", "Development finance", "/100", "score", "demo", 0.77, [82, 76, 61, 66, 65, 70, 74], true, "Financial Data", "portwatch", "gold_investment_readiness*", 0.03),
  // Infrastructure
  L("infra_condition", "Infrastructure condition", "Infrastructure", "/100", "score", "demo", 0.55, [72, 66, 58, 62, 60, 64, 68], true, "Infrastructure", "geospatial", "gold_infra_condition*", 0.02),
  // Governance
  L("governance_evidence", "Governance evidence coverage", "Governance", "%", "percent", "demo", 0.6, [72, 64, 55, 61, 58, 66, 70], true, "Governance", "aprm", "gold_governance_evidence*", 0.03),
  L("agenda2063", "Agenda 2063 progress", "Governance", "/100", "score", "demo", 0.5, [58, 55, 50, 54, 52, 56, 59], true, "Governance", "au", "gold_agenda2063*", 0.03),
  // Climate
  L("weather_risk", "Weather / disruption risk", "Climate", "/5", "score", "demo", 0.62, [3.4, 2.1, 1.8, 1.2, 2.6, 1.9, 1.3], false, "Weather & Marine", "open-meteo", "gold_berth_disruption*", 0.04),
  L("emissions_intensity", "Emissions intensity", "Climate", "tCO₂/unit", "ratio", "demo", 0.5, [0.42, 0.38, 0.5, 0.3, 0.36, 0.34, 0.31], false, "Climate", "sdg", "gold_emissions*", -0.02),
  // Socio-economic
  L("gdp_growth", "GDP growth per capita", "Socio-economic", "%", "percent", "demo", 0.55, [3.4, 5.0, 3.1, 5.6, 6.1, 5.2, 5.8], true, "Financial Data", "worldbank", "gold_sdg_indicators*", 0.03),
  // Planned (no data) — demonstrates the incompatible state
  L("payment_friction", "PAPSS payment friction", "Financial & payments", "index", "index", "planned", 0.3, [], false, "Financial & payments", "papss", "gold_payment_friction*"),
];

export const CATEGORIES: LayerCategory[] = ["Ports & maritime", "Trade & AfCFTA", "Development finance", "Infrastructure", "Governance", "Climate", "Socio-economic", "Financial & payments"];

export function getLayer(id: string): Layer | undefined {
  return LAYERS.find((l) => l.id === id);
}

export function layerEvidence(l: Layer): EvidenceRecord {
  const mean = l.values.length ? Math.round((l.values.reduce((s, v) => s + v, 0) / l.values.length) * 10) / 10 : 0;
  return quickEvidence({
    metric: l.name,
    value: l.values.length ? `${mean} ${l.unit} (7-geo mean)` : "no data",
    objectRef: "object · dataviz layer",
    confidence: l.confidence,
    status: l.status,
    pillar: l.pillar,
    source: l.source,
    gold: l.gold,
    goldDetail: `${l.category} · per-geography layer across the ${GEOS.length} pilot gateways.`,
  });
}

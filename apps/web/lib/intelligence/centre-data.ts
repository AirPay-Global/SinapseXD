import { quickEvidence } from "@/lib/evidence/build";
import type { EvidenceRecord } from "@/lib/evidence/types";

/**
 * Intelligence Centre modules (UI Evolution spec, Priority 6). Deterministic,
 * client-safe demo data for the ten analytical capabilities; every value
 * carries an evidence record so nothing on the screen is a bare number.
 * Marked demo throughout — these become Gold marts + model outputs in v2
 * Phase 5.
 */

export interface Warning {
  severity: "severe" | "high" | "moderate";
  signal: string;
  object: string;
  href?: string;
  action: string;
  decisionId?: string;
  evidence: EvidenceRecord;
}

export const EARLY_WARNINGS: Warning[] = [
  {
    severity: "severe",
    signal: "3.4m swell + 30kn gusts intersect 6 berth windows Thursday",
    object: "port:durban",
    href: "/ontology/port/durban",
    action: "Re-sequence two Panamax calls",
    decisionId: "dec-swell-window",
    evidence: quickEvidence({ metric: "Berth-window disruption risk", value: "severe · 6 windows", objectRef: "object · port:durban", confidence: 0.82, pillar: "Weather & Marine", source: "open-meteo", gold: "gold_berth_disruption*", goldDetail: "Scheduled windows intersected with the forecast risk band.", recommendation: "Re-sequence two Panamax windows off the Thursday peak." }),
  },
  {
    severity: "high",
    signal: "Cinkassé border dwell +38% QoQ — corridor SLA breached",
    object: "corridor:lome-ouagadougou",
    action: "Fast-track single-window pilot",
    decisionId: "dec-lome-border",
    evidence: quickEvidence({ metric: "Border dwell time", value: "5.6 days", objectRef: "object · border:cinkasse", confidence: 0.71, pillar: "Trade Analytics", source: "trade", gold: "gold_border_efficiency*", recommendation: "Fast-track the Cinkassé single-window pilot." }),
  },
  {
    severity: "high",
    signal: "Durban congestion score crossed 60 — above all peer ports",
    object: "port:durban",
    href: "/ontology/port/durban",
    action: "Review berth-window productivity",
    evidence: quickEvidence({ metric: "Congestion Score", value: "61 / 100", objectRef: "object · port:durban", confidence: 0.74, pillar: "AIS + Port Activity", source: "portwatch", gold: "gold_port_congestion*", recommendation: "Shift two Panamax windows off the Thursday swell peak." }),
  },
  {
    severity: "moderate",
    signal: "Asia → West Africa freight rate up 9% in 30 days",
    object: "route:asia-westafrica",
    action: "Re-benchmark tariff competitiveness",
    evidence: quickEvidence({ metric: "Freight rate (FBX proxy)", value: "$3,710 /FEU", objectRef: "object · route:asia-westafrica", confidence: 0.6, pillar: "Market Intel", source: "freight", gold: "gold_freight_rates*", recommendation: "Re-benchmark port tariffs against the rising route rate." }),
  },
];

export interface Anomaly {
  metric: string;
  object: string;
  deviation: string;
  window: string;
  spark: number[];
  evidence: EvidenceRecord;
}

export const ANOMALIES: Anomaly[] = [
  {
    metric: "Container arrivals", object: "port:durban", deviation: "+2.8σ above 90-day mean", window: "last 7 days",
    spark: [12, 11, 13, 12, 11, 14, 13, 12, 16, 19, 20],
    evidence: quickEvidence({ metric: "Container arrivals anomaly", value: "+2.8σ", objectRef: "object · port:durban", confidence: 0.77, pillar: "Port Activity", source: "portwatch", gold: "gold_port_activity_30d", goldDetail: "Rolling z-score on daily arrivals vs 90-day baseline." }),
  },
  {
    metric: "Reefer tariff yield", object: "tariff:reefer @ port:durban", deviation: "−7.1% vs manifested volume", window: "quarter to date",
    spark: [100, 99, 101, 98, 97, 95, 94, 93, 93, 92, 93],
    evidence: quickEvidence({ metric: "Reefer tariff yield anomaly", value: "−7.1%", objectRef: "object · tariff:reefer @ port:durban", confidence: 0.68, pillar: "Financial Data", source: "finance", gold: "gold_revenue_leakage*", recommendation: "Reconcile the reefer tariff rule and back-bill." }),
  },
  {
    metric: "Gateway tonnage — Lomé", object: "port:lome", deviation: "−1.9σ below trend", window: "last 14 days",
    spark: [88, 90, 87, 89, 86, 84, 82, 80, 78, 77, 76],
    evidence: quickEvidence({ metric: "Gateway tonnage anomaly", value: "−1.9σ", objectRef: "object · port:lome", confidence: 0.63, pillar: "Port Activity", source: "portwatch", gold: "gold_port_activity_30d", recommendation: "Correlates with the Cinkassé dwell spike — treat as one incident." }),
  },
];

/** Forecast: port calls per week, history + model projection with band. */
export const FORECAST_SERIES = [
  { week: "W23", actual: 96, forecast: null as number | null, lo: null as number | null, hi: null as number | null },
  { week: "W24", actual: 101, forecast: null, lo: null, hi: null },
  { week: "W25", actual: 98, forecast: null, lo: null, hi: null },
  { week: "W26", actual: 104, forecast: null, lo: null, hi: null },
  { week: "W27", actual: 109, forecast: 109, lo: 109, hi: 109 },
  { week: "W28", actual: null, forecast: 112, lo: 106, hi: 118 },
  { week: "W29", actual: null, forecast: 114, lo: 105, hi: 123 },
  { week: "W30", actual: null, forecast: 117, lo: 106, hi: 128 },
  { week: "W31", actual: null, forecast: 118, lo: 104, hi: 132 },
];

export const FORECAST_EVIDENCE = quickEvidence({
  metric: "Port calls forecast (4 weeks)", value: "118 ±14 by W31", objectRef: "object · port:durban", confidence: 0.58,
  pillar: "Port Activity", source: "portwatch", gold: "gold_portcalls_forecast*",
  goldDetail: "Seasonal-naive projection over the 30-day activity mart; ±1σ band. Model output, not a measurement.",
  recommendation: "Arrivals trend up through July — protect berth-window productivity now.",
});

export interface RcaNode {
  factor: string;
  contribution: number;
  detail: string;
}

export const RCA = {
  question: "Why did Durban's Congestion Score rise +6 this month?",
  conclusion: "Two-thirds of the rise is schedule concentration + swell exposure — both addressable by re-sequencing.",
  nodes: [
    { factor: "Thursday berth-window concentration", contribution: 38, detail: "Six Panamax windows stacked inside one tide cycle." },
    { factor: "Swell-related anchorage holds", contribution: 27, detail: "Two severe-band days forced anchorage waits past 20h." },
    { factor: "Container arrivals above trend", contribution: 21, detail: "+2.8σ arrival anomaly loaded the queue." },
    { factor: "Crane maintenance window", contribution: 14, detail: "Pier 2 crane 4 offline 60h, planned." },
  ] as RcaNode[],
  evidence: quickEvidence({
    metric: "Congestion Score decomposition", value: "+6 pts", objectRef: "object · port:durban", confidence: 0.66,
    pillar: "AIS + Port Activity", source: "portwatch", gold: "gold_port_congestion*",
    goldDetail: "Shapley-style attribution across queue drivers. Illustrative until the congestion mart lands.",
  }),
};

export interface Opportunity {
  title: string;
  object: string;
  value: string;
  rationale: string;
  evidence: EvidenceRecord;
}

export const TRADE_OPPORTUNITIES: Opportunity[] = [
  {
    title: "Capture North-South corridor overflow", object: "corridor:durban-lusaka", value: "+34k TEU",
    rationale: "Gateway throughput +18% YoY with headroom at Durban; competitors capacity-bound.",
    evidence: quickEvidence({ metric: "Corridor growth capture", value: "+34k TEU", objectRef: "object · corridor:durban-lusaka", confidence: 0.72, pillar: "Trade Analytics", source: "portwatch", gold: "gold_corridor_gateway_activity" }),
  },
  {
    title: "Reroute Sahel transit via Lomé", object: "corridor:lome-ouagadougou", value: "$120M/yr",
    rationale: "If Cinkassé dwell returns to ≤3.5 days, Lomé wins back Tema-routed Burkina volumes.",
    evidence: quickEvidence({ metric: "Transit rerouting opportunity", value: "$120M/yr", objectRef: "object · corridor:lome-ouagadougou", confidence: 0.54, pillar: "Trade Analytics", source: "trade", gold: "gold_corridor_trade_flows" }),
  },
  {
    title: "Grow intra-EAC agri flows via Dar", object: "corridor:dar-kigali", value: "+11% flow",
    rationale: "Preferential tariff utilisation on the Central corridor is 22pts below the Northern corridor.",
    evidence: quickEvidence({ metric: "Preference-utilisation gap", value: "22 pts", objectRef: "object · corridor:dar-kigali", confidence: 0.51, pillar: "Trade Analytics", source: "comtrade", gold: "gold_preference_utilisation*" }),
  },
];

export const INVESTMENT_OPPORTUNITIES: Opportunity[] = [
  {
    title: "Mombasa berth-deepening tranche 2", object: "project:mombasa-deepening", value: "$86M",
    rationale: "Tranche-1 covenant verified at +31% throughput uplift; readiness score 82/100.",
    evidence: quickEvidence({ metric: "Investment readiness", value: "82 / 100", objectRef: "object · project:mombasa-deepening", confidence: 0.77, pillar: "Financial Data", source: "portwatch", gold: "gold_dev_impact*" }),
  },
  {
    title: "Cinkassé single-window scale-up", object: "border:cinkasse", value: "$14M",
    rationale: "Highest jobs-per-dollar on the board: border efficiency lifts two corridors at once.",
    evidence: quickEvidence({ metric: "Border investment case", value: "$14M", objectRef: "object · border:cinkasse", confidence: 0.58, pillar: "Trade Analytics", source: "trade", gold: "gold_border_efficiency*" }),
  },
  {
    title: "Durban reefer-stack electrification", object: "port:durban", value: "$22M",
    rationale: "Cuts diesel gensets, unlocks cold-chain SLA product; SDG 9.4 carbon-intensity signal.",
    evidence: quickEvidence({ metric: "Reefer electrification case", value: "$22M", objectRef: "object · port:durban", confidence: 0.49, pillar: "Financial Data", source: "finance", gold: "gold_infra_roi*" }),
  },
];

export const IMPORT_SUBSTITUTION = [
  { commodity: "Refined petroleum → regional refining", index: 74, value: "$8.4B imports" },
  { commodity: "Cereals → intra-African grain corridors", index: 61, value: "$5.1B imports" },
  { commodity: "Fertiliser → Togo/Nigeria capacity", index: 58, value: "$2.7B imports" },
  { commodity: "Pharmaceuticals → AfCFTA pooled procurement", index: 45, value: "$4.9B imports" },
];

export const IMPORT_SUBSTITUTION_EVIDENCE = quickEvidence({
  metric: "Import Substitution Index", value: "top: 74 / 100", objectRef: "object · commodity taxonomy", confidence: 0.5,
  pillar: "Trade Analytics", source: "comtrade", gold: "gold_import_substitution*",
  goldDetail: "Extra-African import value × regional production feasibility. Mart not yet built.",
});

export const BENCHMARK_PORTS = [
  { port: "Durban", score: 78.4 },
  { port: "Tema", score: 74.9 },
  { port: "Mombasa", score: 73.2 },
  { port: "Lomé", score: 71.8 },
  { port: "Dar es Salaam", score: 66.4 },
  { port: "Djibouti", score: 65.1 },
  { port: "Lagos (Apapa)", score: 61.7 },
];

export const BENCHMARK_EVIDENCE = quickEvidence({
  metric: "Port Competitiveness Score — peer set", value: "7 pilot ports", objectRef: "object · ports (pilot set)", confidence: 0.55,
  pillar: "Port Activity", source: "portwatch", gold: "gold_port_competitiveness*",
  goldDetail: "Weighted throughput, wait, connectivity & cost across the pilot peer set. Mart not yet built.",
});

export interface Briefing {
  audience: string;
  title: string;
  date: string;
  bullets: string[];
}

export const BRIEFINGS: Briefing[] = [
  {
    audience: "Port CEO", title: "Durban weekly command briefing", date: "07 Jul 2026",
    bullets: [
      "Arrivals +2.8σ above trend; congestion score 61 and rising — re-sequencing recommended before Thursday's swell.",
      "Reefer revenue leakage confirmed at $1.9M for the quarter; back-billing decision is open in the Decision Centre.",
      "MSC renewal window T-12 days; churn model wants a berth-window guarantee on the table.",
    ],
  },
  {
    audience: "Policy Director", title: "Corridor policy briefing", date: "06 Jul 2026",
    bullets: [
      "Cinkassé dwell breach is now the single largest drag on West-African corridor cost — single-window pilot in execution.",
      "North-South corridor growth (+18% YoY) is outpacing all peers; slot policy review recommended.",
    ],
  },
  {
    audience: "DFI Executive", title: "Portfolio impact briefing", date: "05 Jul 2026",
    bullets: [
      "Mombasa tranche-2 released; outcome monitoring baseline set from the Gold activity mart.",
      "Cinkassé border investment shows the best modelled jobs-per-dollar on the current board.",
    ],
  },
];

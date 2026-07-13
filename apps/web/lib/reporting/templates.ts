import { quickEvidence } from "@/lib/evidence/build";
import type { Framework, ReportMetric, ReportSection } from "./model";

/**
 * Report templates (XDi Reporting spec §12). Each template declares its
 * framework, audience, required sections and the Gold metrics it pulls — the
 * same metrics the dashboards read, each carrying a Bronze→Silver→Gold
 * evidence record. New reports are instantiated from these blueprints.
 */

export interface TemplateSectionBlueprint {
  type: ReportSection["type"];
  title: string;
  /** {ENTITY} / {PERIOD} tokens are substituted when a report is created. */
  content?: string;
}

export interface ReportTemplate {
  id: string;
  framework: Framework;
  name: string;
  audience: string;
  version: string;
  purpose: string;
  sections: TemplateSectionBlueprint[];
  metrics: () => ReportMetric[];
}

let mid = 0;
function met(
  name: string,
  value: string,
  unit: string | undefined,
  status: "live" | "demo" | "planned",
  confidence: number,
  pillar: string,
  source: string,
  gold: string,
  series?: number[],
): ReportMetric {
  return {
    id: `m${++mid}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
    name,
    value,
    unit,
    status,
    confidence,
    series,
    evidence: quickEvidence({
      metric: name,
      value: unit ? `${value} ${unit}` : value,
      objectRef: "object · reporting metric",
      confidence,
      status,
      pillar,
      source,
      gold,
    }),
  };
}

const S = {
  cover: (t: string): TemplateSectionBlueprint => ({ type: "cover", title: t }),
  summary: (c: string): TemplateSectionBlueprint => ({ type: "summary", title: "Executive summary", content: c }),
  kpi: (t: string): TemplateSectionBlueprint => ({ type: "kpi", title: t }),
  chart: (t: string): TemplateSectionBlueprint => ({ type: "chart", title: t }),
  narrative: (t: string, c: string): TemplateSectionBlueprint => ({ type: "narrative", title: t, content: c }),
  exceptions: (c: string): TemplateSectionBlueprint => ({ type: "exceptions", title: "Exceptions & risks", content: c }),
  recs: (c: string): TemplateSectionBlueprint => ({ type: "recommendations", title: "Recommendations", content: c }),
  annex: (c: string): TemplateSectionBlueprint => ({ type: "annexure", title: "Methodology & annexures", content: c }),
};

export const TEMPLATES: ReportTemplate[] = [
  {
    id: "aprm-quarterly",
    framework: "aprm",
    name: "APRM quarterly evidence report",
    audience: "Peer Review Secretariat",
    version: "1.2",
    purpose: "Traceable governance and development evidence for peer-review reporting.",
    sections: [
      S.cover("{ENTITY} — APRM Evidence Report, {PERIOD}"),
      S.summary("This report presents verified governance and development evidence for {ENTITY} covering {PERIOD}, drawn from Sinapse XDi Gold metrics with full lineage to source."),
      S.kpi("Governance & SDG indicators"),
      S.narrative("Governance narrative", "Draft narrative — generate with the AI Advisor or write here. Every claim must cite an attached evidence record."),
      S.exceptions("Indicators without verified evidence, or relying on estimates, are listed here for the peer-review panel."),
      S.recs("Reform priorities where measurable outcomes are lagging targets."),
      S.annex("Indicators reconcile to the Gold marts named in each evidence record. Demo values are illustrative and excluded from official submission."),
    ],
    metrics: () => [
      met("GDP growth per capita (SDG 8.1.1)", "3.4", "%", "demo", 0.55, "Financial Data", "worldbank", "gold_sdg_indicators*", [2.9, 3.1, 3.0, 3.2, 3.4]),
      met("Freight volume index (SDG 9.1.2)", "68", "/100", "demo", 0.5, "Trade Analytics", "comtrade", "gold_sdg_indicators*"),
      met("Income growth, bottom 40% (SDG 10.1.1)", "2.8", "%", "demo", 0.48, "Financial Data", "worldbank", "gold_sdg_indicators*"),
      met("Verified governance evidence coverage", "72", "%", "demo", 0.6, "Governance", "aprm", "gold_governance_evidence*"),
    ],
  },
  {
    id: "port-monthly-exec",
    framework: "port",
    name: "Port monthly executive report",
    audience: "Port Board",
    version: "2.0",
    purpose: "Operational, commercial and financial performance for the board.",
    sections: [
      S.cover("{ENTITY} — Executive Performance Report, {PERIOD}"),
      S.summary("Operational and commercial performance for {ENTITY}, {PERIOD}. Port calls and throughput are drawn from live IMF PortWatch activity; score marts are illustrative until built."),
      S.kpi("Operational & commercial KPIs"),
      S.chart("Throughput trend"),
      S.narrative("Commercial commentary", "Draft — cover revenue vs forecast, anchor-line risk and berth productivity, each tied to a metric."),
      S.exceptions("Congestion, dwell-time and weather-disruption exceptions for the period."),
      S.recs("Actions to defend competitiveness and protect revenue."),
      S.annex("Methodology: 30-day rolling windows over the canonical port. Score marts flagged where not yet built."),
    ],
    metrics: () => [
      met("Port calls (30d)", "409", undefined, "live", 0.95, "Port Activity", "portwatch", "gold_port_activity_30d", [372, 388, 401, 396, 409]),
      met("Throughput (30d)", "214.6", "k TEU", "live", 0.9, "Port Activity", "portwatch", "gold_port_activity_30d", [198, 205, 209, 211, 214.6]),
      met("Congestion score", "61", "/100", "demo", 0.74, "AIS + Port Activity", "portwatch", "gold_port_congestion*", [52, 55, 58, 60, 61]),
      met("Revenue vs forecast", "-4.1", "%", "demo", 0.66, "Financial Data", "finance", "gold_port_revenue*"),
      met("Port competitiveness score", "78.4", "/100", "demo", 0.72, "Port Activity", "portwatch", "gold_port_competitiveness*"),
    ],
  },
  {
    id: "dfi-project-monitoring",
    framework: "dfi",
    name: "DFI project monitoring report",
    audience: "Investment Committee",
    version: "1.4",
    purpose: "Project performance, portfolio risk and measurable development impact.",
    sections: [
      S.cover("{ENTITY} — Project Monitoring Report, {PERIOD}"),
      S.summary("Monitoring status for {ENTITY}, {PERIOD}: covenant compliance, disbursement and measured development outcomes against committed targets."),
      S.kpi("Project & impact KPIs"),
      S.narrative("Impact narrative", "Draft — outcomes achieved versus committed targets, with the trade multiplier and jobs evidence."),
      S.exceptions("Covenant, schedule and budget risks requiring committee attention."),
      S.recs("Tranche and covenant recommendations."),
      S.annex("Impact attributed via pre/post windows around works completion; PMIS feed is a deferred data product."),
    ],
    metrics: () => [
      met("Throughput uplift vs baseline", "+31", "%", "demo", 0.77, "Port Activity", "portwatch", "gold_dev_impact*", [0, 9, 18, 26, 31]),
      met("Jobs created (direct+indirect)", "4,100", undefined, "demo", 0.6, "Financial Data", "pmis", "gold_dev_impact*"),
      met("Investment readiness score", "82", "/100", "demo", 0.77, "Financial Data", "portwatch", "gold_investment_readiness*"),
      met("Covenant — transit-time index", "6.2", "days", "demo", 0.7, "Trade Analytics", "trade", "gold_corridor_performance*"),
    ],
  },
  {
    id: "afcfta-corridor",
    framework: "afcfta",
    name: "AfCFTA corridor performance report",
    audience: "AfCFTA Secretariat",
    version: "1.1",
    purpose: "Corridor performance, customs efficiency and rules-of-origin outcomes.",
    sections: [
      S.cover("{ENTITY} — Corridor Performance Report, {PERIOD}"),
      S.summary("Implementation and corridor performance for {ENTITY}, {PERIOD}, including border efficiency and rules-of-origin verification."),
      S.kpi("Corridor & trade KPIs"),
      S.chart("Gateway throughput trend"),
      S.narrative("Integration narrative", "Draft — intra-African trade movement, corridor bottlenecks and RoO issues needing intervention."),
      S.exceptions("Border and customs bottlenecks; rules-of-origin verification gaps."),
      S.recs("Interventions to lift corridor performance and preference utilisation."),
    ],
    metrics: () => [
      met("Gateway throughput (30d)", "+18", "% YoY", "demo", 0.79, "Port Activity", "portwatch", "gold_corridor_gateway_activity", [4, 8, 12, 16, 18]),
      met("Border dwell time", "5.6", "days", "demo", 0.71, "Trade Analytics", "trade", "gold_border_efficiency*"),
      met("Bilateral trade value (latest yr)", "$2.1", "B", "demo", 0.8, "Trade Analytics", "comtrade", "gold_corridor_trade_flows"),
      met("Verified rules-of-origin coverage", "84", "%", "demo", 0.64, "Trade Analytics", "trade", "gold_dtp_compliance*"),
    ],
  },
  {
    id: "government-trade",
    framework: "government",
    name: "National trade performance report",
    audience: "Ministry of Trade",
    version: "1.0",
    purpose: "Trade, infrastructure and market data as policy-ready evidence.",
    sections: [
      S.cover("{ENTITY} — National Trade Performance, {PERIOD}"),
      S.summary("National trade performance for {ENTITY}, {PERIOD}, aligned to development-plan targets."),
      S.kpi("Trade & corridor KPIs"),
      S.narrative("Policy narrative", "Draft — trade-cost movement, corridor development and modernisation priorities."),
      S.recs("Policy levers ranked by modelled impact on trade cost and volume."),
    ],
    metrics: () => [
      met("National trade value (latest yr)", "$9.4", "B", "demo", 0.7, "Trade Analytics", "comtrade", "gold_corridor_trade_flows"),
      met("Corridor transit time", "8.4", "days", "demo", 0.68, "Trade Analytics", "portwatch", "gold_corridor_performance*"),
      met("Preferential tariff utilisation", "61", "%", "demo", 0.55, "Trade Analytics", "comtrade", "gold_preference_utilisation*"),
    ],
  },
  {
    id: "au-agenda2063",
    framework: "au",
    name: "Agenda 2063 progress report",
    audience: "AU Commission",
    version: "1.0",
    purpose: "Continental integration and Agenda 2063 delivery.",
    sections: [
      S.cover("{ENTITY} — Agenda 2063 Progress, {PERIOD}"),
      S.summary("Progress against Agenda 2063 goals for {ENTITY}, {PERIOD}, with continental-integration scoring."),
      S.kpi("Agenda 2063 & integration KPIs"),
      S.narrative("Delivery narrative", "Draft — infrastructure, industrialisation and integration progress."),
      S.recs("Priority programmes to accelerate delivery."),
    ],
    metrics: () => [
      met("Agenda 2063 Goal 10 (infrastructure)", "58", "/100", "demo", 0.5, "Governance", "au", "gold_agenda2063*"),
      met("Continental integration index", "0.34", undefined, "demo", 0.5, "Trade Analytics", "comtrade", "gold_integration_index*"),
      met("Intra-African trade share", "15.2", "%", "demo", 0.6, "Trade Analytics", "comtrade", "gold_corridor_trade_flows"),
    ],
  },
  {
    id: "afreximbank-tradefinance",
    framework: "afreximbank",
    name: "Afreximbank trade-finance impact report",
    audience: "Afreximbank",
    version: "1.0",
    purpose: "How finance, corridors, payments and industrialisation unlock trade.",
    sections: [
      S.cover("{ENTITY} — Trade-Finance Impact, {PERIOD}"),
      S.summary("Trade-finance and corridor-investment impact for {ENTITY}, {PERIOD}."),
      S.kpi("Finance & trade-multiplier KPIs"),
      S.narrative("Impact narrative", "Draft — how deployed finance moved corridor volume, import substitution and industrialisation."),
      S.recs("Blended-finance opportunities with the strongest trade multiplier."),
    ],
    metrics: () => [
      met("Corridor investment deployed", "$86", "M", "demo", 0.7, "Financial Data", "finance", "gold_dev_impact*"),
      met("Trade multiplier", "3.4", "x", "demo", 0.55, "Trade Analytics", "comtrade", "gold_trade_multiplier*"),
      met("Import substitution index (top)", "74", "/100", "demo", 0.5, "Trade Analytics", "comtrade", "gold_import_substitution*"),
    ],
  },
  {
    id: "custom-blank",
    framework: "custom",
    name: "Custom report",
    audience: "Custom",
    version: "1.0",
    purpose: "Build institution-specific reports from approved objects and evidence.",
    sections: [
      S.cover("{ENTITY} — Custom Report, {PERIOD}"),
      S.summary("Custom report for {ENTITY}, {PERIOD}."),
      S.kpi("Selected KPIs"),
      S.narrative("Narrative", "Draft — add your narrative here."),
      S.recs("Recommendations."),
    ],
    metrics: () => [],
  },
];

export function getTemplate(id: string): ReportTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Ontology entity types the wizard offers (§6 Step 3). */
export const ENTITY_TYPES = [
  "Country",
  "Region / REC",
  "Port",
  "Corridor",
  "Border Post",
  "Commodity",
  "Project",
  "Programme",
  "Investment",
  "Institution",
  "DFI",
  "Policy",
  "SDG",
  "Agenda 2063 target",
  "APRM indicator",
] as const;

/** A few concrete entity suggestions per type, grounded in the seed ontology. */
export const ENTITY_SUGGESTIONS: Record<string, Array<{ id: string; label: string }>> = {
  Port: [
    { id: "durban", label: "Port of Durban" },
    { id: "mombasa", label: "Port of Mombasa" },
    { id: "lagos", label: "Port of Lagos (Apapa)" },
    { id: "tema", label: "Port of Tema" },
  ],
  Corridor: [
    { id: "durban-lusaka", label: "Durban–Lusaka (North-South)" },
    { id: "mombasa-kampala", label: "Mombasa–Kampala (Northern)" },
    { id: "lome-ouagadougou", label: "Lomé–Ouagadougou" },
  ],
  Country: [
    { id: "zaf", label: "South Africa" },
    { id: "ken", label: "Kenya" },
    { id: "nga", label: "Nigeria" },
  ],
  Project: [{ id: "mombasa-deepening", label: "Mombasa berth-deepening" }],
};

export const PERIOD_PRESETS = ["2026-07 (Monthly)", "2026-Q2 (Quarterly)", "2026-H1 (Half-year)", "2026 (Annual)", "Custom dates"];

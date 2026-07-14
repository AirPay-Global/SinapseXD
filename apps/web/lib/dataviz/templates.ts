import type { VizType } from "./viz";

/**
 * Overlay templates (spec §23) and start questions (§6). Each names its layers
 * and a base visualisation; the workspace loads them onto the canvas.
 */

export interface OverlayTemplate {
  id: string;
  group: string;
  name: string;
  layers: string[];
  viz: VizType;
  blurb: string;
}

export const TEMPLATES: OverlayTemplate[] = [
  { id: "congestion-calls", group: "Port & maritime", name: "Port congestion vs vessel calls", layers: ["congestion", "port_calls"], viz: "scatter", blurb: "Do busier ports run more congested?" },
  { id: "weather-wait", group: "Port & maritime", name: "Weather risk vs anchorage wait", layers: ["anchorage_wait", "weather_risk"], viz: "scatter", blurb: "Does disruption risk track anchorage delay?" },
  { id: "revenue-throughput", group: "Port & maritime", name: "Revenue vs throughput", layers: ["throughput", "port_revenue"], viz: "map", blurb: "Where does volume convert to revenue?" },
  { id: "dwell-trade", group: "AfCFTA & trade", name: "Border dwell vs intra-African trade", layers: ["trade_share", "border_dwell"], viz: "scatter", blurb: "Do slower borders depress trade share?" },
  { id: "substitution", group: "AfCFTA & trade", name: "Import substitution potential", layers: ["import_substitution", "corridor_throughput"], viz: "bar", blurb: "Where could regional production replace imports?" },
  { id: "dfi-impact", group: "DFI & Afreximbank", name: "DFI investment vs development impact", layers: ["dfi_investment", "dev_impact"], viz: "scatter", blurb: "Is capital landing where impact follows?" },
  { id: "readiness-infra", group: "DFI & Afreximbank", name: "Investment readiness vs infrastructure", layers: ["investment_readiness", "infra_condition"], viz: "heatmap", blurb: "Readiness against physical condition." },
  { id: "gov-delivery", group: "APRM & AU", name: "Governance evidence vs project delivery", layers: ["governance_evidence", "dev_impact"], viz: "scatter", blurb: "Does governance track delivery?" },
  { id: "agenda-geo", group: "APRM & AU", name: "Agenda 2063 progress by geography", layers: ["agenda2063"], viz: "map", blurb: "Where is progress concentrated?" },
  { id: "climate-infra", group: "Climate & infrastructure", name: "Climate risk vs infrastructure exposure", layers: ["weather_risk", "infra_condition"], viz: "map", blurb: "Which assets sit in the risk band?" },
  { id: "emissions-activity", group: "Climate & infrastructure", name: "Emissions vs port activity", layers: ["port_calls", "emissions_intensity"], viz: "scatter", blurb: "Does activity drive carbon intensity?" },
  { id: "relational", group: "Cross-domain", name: "Port → Corridor → Project → DFI → SDG", layers: ["throughput", "corridor_throughput", "dfi_investment"], viz: "network", blurb: "Follow the ontology chain." },
];

export const QUESTIONS: Array<{ q: string; templateId: string }> = [
  { q: "Where do high port delays overlap with growing trade demand?", templateId: "congestion-calls" },
  { q: "Do slower borders depress intra-African trade?", templateId: "dwell-trade" },
  { q: "Is DFI capital landing where development impact follows?", templateId: "dfi-impact" },
  { q: "Which ports sit in the weather-disruption risk band?", templateId: "climate-infra" },
  { q: "Where could African production substitute imports?", templateId: "substitution" },
];

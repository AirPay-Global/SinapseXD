import { ADVISORS } from "@/lib/ai/advisors";
import { SEED_DECISIONS } from "@/lib/decisions/seed";
import { OBJECT_TYPES } from "@/lib/ontology/catalogue";

/**
 * Universal Object Search index (UI Evolution spec, Navigation). Everything a
 * user can name — ontology objects, decisions, advisors, screens — resolves
 * to one flat, client-side index behind ⌘K. Instances mirror the profile
 * pages' seed data; when object registries go live this becomes a server
 * search over the ontology tables.
 */

export interface SearchEntry {
  group: "Objects" | "Decisions" | "Screens" | "AI Advisors" | "Object types";
  label: string;
  sub: string;
  href: string;
  /** Extra tokens to match on. */
  keywords?: string;
}

const PORTS: Array<[string, string]> = [
  ["durban", "Port of Durban · ZAF"],
  ["mombasa", "Port of Mombasa · KEN"],
  ["lagos", "Port of Lagos (Apapa) · NGA"],
  ["lome", "Port of Lomé · TGO"],
  ["djibouti", "Port of Djibouti · DJI"],
  ["dar", "Port of Dar es Salaam · TZA"],
  ["tema", "Port of Tema · GHA"],
];

const CORRIDORS: Array<[string, string]> = [
  ["durban-lusaka", "Durban–Lusaka (North-South)"],
  ["mombasa-kampala", "Mombasa–Kampala (Northern)"],
  ["dar-kigali", "Dar–Kigali (Central)"],
  ["djibouti-addis", "Djibouti–Addis Ababa"],
  ["lome-ouagadougou", "Lomé–Ouagadougou"],
  ["tema-bamako", "Tema–Bamako"],
  ["lagos-niamey", "Lagos–Niamey"],
];

const COUNTRIES: Array<[string, string]> = [
  ["zaf", "South Africa · SADC"],
  ["ken", "Kenya · EAC"],
  ["nga", "Nigeria · ECOWAS"],
  ["tgo", "Togo · ECOWAS"],
  ["dji", "Djibouti · COMESA"],
  ["tza", "Tanzania · EAC"],
  ["gha", "Ghana · ECOWAS"],
];

const SCREENS: Array<[string, string, string]> = [
  ["Decision Centre", "What needs your decision today", "/decision"],
  ["Workflow Centre", "Decision lifecycle board", "/workflow"],
  ["Intelligence Centre", "Forecasts, anomalies, opportunities, briefings", "/intelligence"],
  ["Simulation Centre", "What-if levers: trade, GDP, jobs, ROI", "/simulation"],
  ["Digital Twin", "Africa → … → Container drill", "/twin"],
  ["Ontology Explorer", "Browse the objects, not the tables", "/ontology"],
  ["Evidence Centre", "Bronze → Silver → Gold lineage", "/evidence"],
  ["AI Advisors", "13 domain specialists", "/jarvis"],
  ["Stakeholders", "Command-centre catalogue", "/stakeholders"],
  ["APRM Reports", "Governance reporting exports", "/reports/aprm"],
  ["Port Authority dashboard", "Stakeholder command centre", "/dashboard/port"],
  ["Government & Policy dashboard", "Stakeholder command centre", "/dashboard/government"],
  ["DFI Investment dashboard", "Stakeholder command centre", "/dashboard/dfi"],
  ["AfCFTA Monitoring dashboard", "Stakeholder command centre", "/dashboard/afcfta"],
];

export function buildSearchIndex(): SearchEntry[] {
  return [
    ...PORTS.map<SearchEntry>(([id, label]) => ({ group: "Objects", label, sub: `port:${id}`, href: `/ontology/port/${id}`, keywords: "port harbour gateway" })),
    ...CORRIDORS.map<SearchEntry>(([id, label]) => ({ group: "Objects", label, sub: `corridor:${id}`, href: `/ontology/corridor/${id}`, keywords: "corridor route" })),
    ...COUNTRIES.map<SearchEntry>(([id, label]) => ({ group: "Objects", label, sub: `country:${id.toUpperCase()}`, href: `/ontology/country/${id}`, keywords: "country nation" })),
    ...SEED_DECISIONS.map<SearchEntry>((d) => ({ group: "Decisions", label: d.problem, sub: `${d.stakeholder} · ${d.valueAtRisk.amount} at stake`, href: `/decision/${d.id}`, keywords: d.relatedObjects.map((o) => o.label).join(" ") })),
    ...ADVISORS.map<SearchEntry>((a) => ({ group: "AI Advisors", label: a.name, sub: a.tagline, href: "/jarvis", keywords: a.domain })),
    ...SCREENS.map<SearchEntry>(([label, sub, href]) => ({ group: "Screens", label, sub, href })),
    ...OBJECT_TYPES.filter((o) => !o.href).map<SearchEntry>((o) => ({ group: "Object types", label: o.name, sub: `${o.status} · ${o.goldOutput}`, href: "/ontology", keywords: o.description })),
  ];
}

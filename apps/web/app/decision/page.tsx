import { createOntology } from "@/lib/ontology/sdk";
import type { EvidenceRecord, LineageStage } from "@/lib/evidence/types";
import { DecisionCentreView, type Deck, type Tile } from "./decision-view";

const ASOF = "as of 07 Jul 2026, 14:20 UTC";

// Reusable lineage fragments referencing the real lakehouse zones we built.
const portActivityLineage: LineageStage[] = [
  { zone: "bronze", title: "IMF PortWatch daily feed", locator: "pillar/port_activity", detail: "Daily port calls & trade-volume estimates, landed as immutable Parquet and checksummed.", sources: ["portwatch", "sha256:1c74…"] },
  { zone: "silver", title: "Normalise & ontology-key", locator: "port_activity_daily", detail: "Deduplicated, UTC-normalised, resolved to canonical port:durban.", sources: ["ontology-keyed", "idempotent upsert"] },
  { zone: "gold", title: "30-day rolling activity", locator: "gold_port_activity_30d", detail: "Aggregated per canonical port over the trailing 30 days.", sources: ["1 formula", "30-day window"] },
];

export default async function DecisionCentre() {
  const onto = await createOntology();
  const activity = await onto.ports.activity30d("durban");
  const live = activity.data !== null;
  const portCalls = live ? activity.data!.port_calls_30d : 409;

  const tiles: Tile[] = [
    {
      name: "Port Competitiveness Score", value: "78.4", unit: "/100", delta: "▲ 2.1 vs Q2", deltaDir: "up",
      spark: [70, 72, 71, 74, 73, 76, 75, 78.4], status: "demo",
      evidence: { metric: "Port Competitiveness Score", value: "78.4 / 100", objectRef: "object · port:durban", asOf: ASOF, confidence: 0.86, status: "demo",
        lineage: [
          { zone: "bronze", title: "PortWatch + trade feeds", locator: "pillar/port_activity", detail: "Daily calls, throughput & trade-volume estimates.", sources: ["portwatch"] },
          { zone: "silver", title: "Conform & peer-benchmark", locator: "port_activity_daily", detail: "Peer-normalised against the 7 pilot ports.", sources: ["ontology-keyed"] },
          { zone: "gold", title: "Port Competitiveness Score", locator: "gold_port_competitiveness*", detail: "Weighted throughput, wait, connectivity & cost. Score mart not yet built.", sources: ["composite", "planned"] },
        ],
        recommendation: "Defend rank by closing the berth-productivity gap before the MSC renewal." },
    },
    {
      name: "Congestion Score", value: "61", unit: "/100", delta: "▲ 6 — watch", deltaDir: "down",
      spark: [48, 50, 53, 52, 55, 58, 60, 61], status: "demo",
      evidence: { metric: "Congestion Score", value: "61 / 100", objectRef: "object · port:durban", asOf: ASOF, confidence: 0.74, status: "demo",
        lineage: [
          { zone: "bronze", title: "AIS + PortWatch daily", locator: "pillar/ais · pillar/port_activity", detail: "Vessel positions & daily port calls.", sources: ["ais", "portwatch"] },
          { zone: "silver", title: "Voyage & event normalise", locator: "port_activity_daily", detail: "Anchorage waits derived, ontology-keyed.", sources: ["ontology-keyed"] },
          { zone: "gold", title: "Congestion Score", locator: "gold_port_congestion*", detail: "Anchorage wait vs berth capacity, indexed 0–100. Score mart not yet built.", sources: ["planned"] },
        ],
        recommendation: "Shift two Panamax windows off the Thursday swell peak to hold anchorage wait under 18h." },
    },
    {
      name: "Port calls (30d)", value: portCalls.toLocaleString("en-US"), delta: live ? "live · PortWatch" : "▲ 4.2% vs prior 30d", deltaDir: "up",
      spark: [11, 13, 11, 13, 11, 17, 15, 20], status: live ? "live" : "demo",
      evidence: { metric: "Port calls (30 days)", value: portCalls.toLocaleString("en-US"), objectRef: "object · port:durban", asOf: ASOF, confidence: live ? 0.95 : 0.4, status: live ? "live" : "demo",
        lineage: portActivityLineage,
        recommendation: "Watch berth-window productivity — arrivals are running ahead of the 30-day trend." },
    },
    {
      name: "Throughput (30d)", value: "214.6k", unit: "TEU", delta: "▲ 2.9% vs prior 30d", deltaDir: "up",
      spark: [150, 149, 117, 150, 155, 130, 160, 165], status: live ? "live" : "demo",
      evidence: { metric: "Throughput (30 days)", value: "214,600 TEU", objectRef: "object · port:durban", asOf: ASOF, confidence: live ? 0.9 : 0.4, status: live ? "live" : "demo",
        lineage: portActivityLineage,
        recommendation: "Capacity headroom exists — prioritise the growing North-South corridor volume." },
    },
  ];

  const decks: Deck[] = [
    {
      sev: "hi", objectRef: "object · tariff:reefer @ port:durban", title: "Revenue leakage up 7% on reefer tariffs",
      body: "Reefer plug-in fees under-billed vs manifest on 214 calls this quarter — the largest correctable loss.",
      recommendation: "Reconcile the reefer tariff rule and back-bill; est. recovery this quarter.",
      impactLabel: "Revenue at stake", impactValue: "$1.9M",
      evidence: { metric: "Reefer revenue leakage", value: "$1.9M", objectRef: "object · tariff:reefer @ port:durban", asOf: "quarter to 07 Jul 2026", confidence: 0.68, status: "demo",
        lineage: [
          { zone: "bronze", title: "Manifests + tariff records", locator: "pillar/finance · CRM*", detail: "Billed fees vs manifested reefer plug-ins. First-party CRM source is a deferred data product.", sources: ["finance", "crm* (planned)"] },
          { zone: "silver", title: "Reconcile billed vs due", locator: "tariff_reconciliation*", detail: "Matched 214 calls; flagged under-billed lines.", sources: ["rule-based"] },
          { zone: "gold", title: "Revenue leakage", locator: "gold_revenue_leakage*", detail: "Sum of under-billed reefer tariff lines. Illustrative — mart not yet built.", sources: ["estimate", "planned"] },
        ],
        recommendation: "Reconcile the reefer tariff rule and back-bill; est. recovery $1.9M this quarter." },
    },
    {
      sev: "md", objectRef: "object · customer:MSC", title: "MSC contract renewal in 12 days",
      body: "MSC is 22% of container volume. Health score dipped as Durban’s congestion rose above peer ports.",
      recommendation: "Open renewal with a berth-window guarantee; model a 3% rate concession vs churn risk.",
      impactLabel: "Annual volume", impactValue: "0.62M TEU",
      evidence: { metric: "MSC customer health", value: "62", objectRef: "object · customer:MSC", asOf: "as of 07 Jul 2026", confidence: 0.55, status: "planned",
        lineage: [
          { zone: "bronze", title: "CRM + volume history", locator: "CRM* · pillar/ais", detail: "First-party account data is deferred; volume proxied from AIS calls.", sources: ["crm* (planned)", "ais proxy"] },
          { zone: "silver", title: "Enrich & score signals", locator: "customer_health*", detail: "Volume trend, congestion exposure, contract stage.", sources: ["partial data"] },
          { zone: "gold", title: "Customer Health Score", locator: "gold_customer_health*", detail: "Composite churn-risk index. Low confidence until CRM lands.", sources: ["planned"] },
        ],
        recommendation: "Open renewal with a berth-window guarantee; model a 3% concession vs churn risk." },
    },
    {
      sev: "gd", objectRef: "object · corridor:durban-lusaka", title: "Angola corridor growing +18%",
      body: "Throughput on the gateway is up 18% YoY — capacity headroom exists to capture the overflow.",
      recommendation: "Prioritise the North-South corridor slot allocation; flag to commercial for outreach.",
      impactLabel: "Growth capture", impactValue: "+34k TEU",
      evidence: { metric: "Corridor gateway throughput", value: "+18% YoY", objectRef: "object · corridor:durban-lusaka", asOf: "YoY to 07 Jul 2026", confidence: 0.79, status: live ? "live" : "demo",
        lineage: [
          { zone: "bronze", title: "PortWatch gateway activity", locator: "pillar/port_activity", detail: "Origin-port daily calls & tonnage for the corridor gateway.", sources: ["portwatch"] },
          { zone: "silver", title: "Attribute to corridor", locator: "port_activity_daily", detail: "Joined via ont_corridor.origin_port_id (ontology link).", sources: ["ontology link"] },
          { zone: "gold", title: "Corridor gateway activity", locator: "gold_corridor_gateway_activity", detail: "30-day throughput at the coastal gateway port.", sources: ["gateway proxy"] },
        ],
        recommendation: "Prioritise North-South slot allocation; flag to commercial for targeted outreach." },
    },
  ];

  return <DecisionCentreView decks={decks} tiles={tiles} />;
}

import { createOntology } from "@/lib/ontology/sdk";
import type { LineageStage } from "@/lib/evidence/types";
import { DecisionCentreView, type Tile } from "./decision-view";

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

  // Decision work items are seeded client-side (lib/decisions/seed.ts) and
  // hydrated with user actions from the decision store.
  return <DecisionCentreView tiles={tiles} />;
}

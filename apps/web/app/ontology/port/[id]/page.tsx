import { notFound } from "next/navigation";
import { createOntology } from "@/lib/ontology/sdk";
import type { LineageStage } from "@/lib/evidence/types";
import { ProfileView, type ProfileData } from "./profile-view";

const ASOF = "as of 07 Jul 2026, 14:20 UTC";

const portActivityLineage: LineageStage[] = [
  { zone: "bronze", title: "IMF PortWatch daily feed", locator: "pillar/port_activity", detail: "Daily port calls & trade-volume estimates, checksummed Parquet.", sources: ["portwatch", "sha256:1c74…"] },
  { zone: "silver", title: "Normalise & ontology-key", locator: "port_activity_daily", detail: "Deduplicated, UTC-normalised, resolved to the canonical port.", sources: ["ontology-keyed"] },
  { zone: "gold", title: "30-day rolling activity", locator: "gold_port_activity_30d", detail: "Aggregated per canonical port over the trailing 30 days.", sources: ["30-day window"] },
];

// Demo fallbacks for the pilot ports so a profile always renders (Design Bible:
// no empty states) even before the pipeline is live / when unauthenticated.
const DEMO: Record<string, { name: string; meta: string[]; country: [string, string] }> = {
  durban: { name: "Port of Durban", meta: ["id: port:durban", "ZAF · SADC", "UN/LOCODE ZADUR"], country: ["South Africa", "ZAF"] },
  mombasa: { name: "Port of Mombasa", meta: ["id: port:mombasa", "KEN · EAC", "UN/LOCODE KEMBA"], country: ["Kenya", "KEN"] },
  lagos: { name: "Port of Lagos (Apapa)", meta: ["id: port:lagos", "NGA · ECOWAS", "UN/LOCODE NGLOS"], country: ["Nigeria", "NGA"] },
  lome: { name: "Port of Lomé", meta: ["id: port:lome", "TGO · ECOWAS", "UN/LOCODE TGLFW"], country: ["Togo", "TGO"] },
  djibouti: { name: "Port of Djibouti", meta: ["id: port:djibouti", "DJI · COMESA", "UN/LOCODE DJJIB"], country: ["Djibouti", "DJI"] },
  dar: { name: "Port of Dar es Salaam", meta: ["id: port:dar", "TZA · EAC", "UN/LOCODE TZDAR"], country: ["Tanzania", "TZA"] },
  tema: { name: "Port of Tema", meta: ["id: port:tema", "GHA · ECOWAS", "UN/LOCODE GHTEM"], country: ["Ghana", "GHA"] },
};

export default async function PortProfile({ params }: { params: { id: string } }) {
  const id = params.id;
  const demo = DEMO[id];
  if (!demo) notFound();

  const onto = await createOntology();
  const port = await onto.ports.get(id);
  const activity = await onto.ports.activity30d(id);
  const live = activity.data !== null;
  const objectRef = `object · port:${id}`;

  const callsValue = live ? activity.data!.port_calls_30d.toLocaleString("en-US") : "409";
  const status: ProfileData["status"] = live ? "live" : "demo";

  const data: ProfileData = {
    name: port?.name ? `Port of ${port.name}` : demo.name,
    id,
    meta: demo.meta,
    status,
    confidence: live ? 0.9 : 0.6,
    relationships: [
      { kind: "country", label: demo.country[0], href: `/dashboard/government` },
      { kind: "berths ×6", label: "Pier 1–2, Point" },
      { kind: "corridor", label: `${port?.name ?? demo.name.replace("Port of ", "")} gateway` },
      { kind: "vessels", label: "In approach" },
      { kind: "shipping lines ×12", label: "MSC, Maersk…" },
    ],
    metrics: [
      {
        name: "Port Competitiveness Score", value: "78.4", tone: "ok",
        evidence: { metric: "Port Competitiveness Score", value: "78.4 / 100", objectRef, asOf: ASOF, confidence: 0.86, status: "demo",
          lineage: [
            { zone: "bronze", title: "PortWatch + trade feeds", locator: "pillar/port_activity", detail: "Daily calls, throughput & trade estimates.", sources: ["portwatch"] },
            { zone: "silver", title: "Conform & peer-benchmark", locator: "port_activity_daily", detail: "Peer-normalised against the 7 pilot ports.", sources: ["ontology-keyed"] },
            { zone: "gold", title: "Port Competitiveness Score", locator: "gold_port_competitiveness*", detail: "Weighted throughput, wait, connectivity & cost. Mart not yet built.", sources: ["composite", "planned"] },
          ],
          recommendation: "Defend rank by closing the berth-productivity gap." },
      },
      {
        name: "Congestion Score", value: "61", tone: "warn",
        evidence: { metric: "Congestion Score", value: "61 / 100", objectRef, asOf: ASOF, confidence: 0.74, status: "demo",
          lineage: [
            { zone: "bronze", title: "AIS + PortWatch daily", locator: "pillar/ais · pillar/port_activity", detail: "Vessel positions & daily calls.", sources: ["ais", "portwatch"] },
            { zone: "silver", title: "Voyage & event normalise", locator: "port_activity_daily", detail: "Anchorage waits derived, ontology-keyed.", sources: ["ontology-keyed"] },
            { zone: "gold", title: "Congestion Score", locator: "gold_port_congestion*", detail: "Anchorage wait vs berth capacity, 0–100. Mart not yet built.", sources: ["planned"] },
          ],
          recommendation: "Shift two Panamax windows off the Thursday swell peak." },
      },
      {
        name: "Port calls (30d)", value: callsValue, tone: "plain",
        evidence: { metric: "Port calls (30 days)", value: callsValue, objectRef, asOf: ASOF, confidence: live ? 0.95 : 0.4, status,
          lineage: portActivityLineage, recommendation: "Arrivals are running ahead of the 30-day trend — watch berth productivity." },
      },
      {
        name: "Throughput (30d)", value: "214.6k TEU", tone: "plain",
        evidence: { metric: "Throughput (30 days)", value: "214,600 TEU", objectRef, asOf: ASOF, confidence: live ? 0.9 : 0.4, status,
          lineage: portActivityLineage, recommendation: "Capacity headroom exists — prioritise growing corridor volume." },
      },
    ],
    timeline: [
      { time: "07 Jul · 14:20 UTC", text: "PortWatch daily feed ingested → Bronze (checksummed)" },
      { time: "07 Jul · 06:30", text: "Congestion Score crossed 60 — flagged to Decision Centre" },
      { time: "02 Jul", text: "MSC renewal window opened (T-12 days)" },
    ],
    aiSummary:
      `${demo.name} is holding strong competitiveness in the region, but anchorage wait has crept up while container arrivals run above trend. Revenue leakage on reefer tariffs is the largest correctable loss this quarter. Recommended focus: berth-window productivity before the MSC renewal.`,
  };

  return <ProfileView data={data} />;
}

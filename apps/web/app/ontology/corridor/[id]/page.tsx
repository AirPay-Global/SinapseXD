import { notFound } from "next/navigation";
import { createOntology } from "@/lib/ontology/sdk";
import { ObjectProfile, type ProfileData } from "@/components/ontology/object-profile";

const ASOF = "as of 07 Jul 2026, 14:20 UTC";
const CORRIDOR_ICON = "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4M8 17h6a3 3 0 0 0 3-3V9";

// Demo fallback so a profile always renders before the pipeline/auth is live.
const DEMO: Record<string, { name: string; originPortId: string; originName: string; destinationName: string; countries: string[] }> = {
  "durban-lusaka": { name: "Durban–Lusaka (North-South)", originPortId: "durban", originName: "Durban", destinationName: "Lusaka", countries: ["South Africa", "Zambia"] },
  "mombasa-kampala": { name: "Mombasa–Kampala (Northern)", originPortId: "mombasa", originName: "Mombasa", destinationName: "Kampala", countries: ["Kenya", "Uganda"] },
  "dar-kigali": { name: "Dar–Kigali (Central)", originPortId: "dar", originName: "Dar es Salaam", destinationName: "Kigali", countries: ["Tanzania", "Rwanda"] },
  "djibouti-addis": { name: "Djibouti–Addis Ababa", originPortId: "djibouti", originName: "Djibouti", destinationName: "Addis Ababa", countries: ["Djibouti", "Ethiopia"] },
  "lome-ouagadougou": { name: "Lomé–Ouagadougou", originPortId: "lome", originName: "Lomé", destinationName: "Ouagadougou", countries: ["Togo", "Burkina Faso"] },
  "tema-bamako": { name: "Tema–Bamako", originPortId: "tema", originName: "Tema", destinationName: "Bamako", countries: ["Ghana", "Mali"] },
  "lagos-niamey": { name: "Lagos–Niamey", originPortId: "lagos", originName: "Lagos", destinationName: "Niamey", countries: ["Nigeria", "Niger"] },
};

export default async function CorridorProfile({ params }: { params: { id: string } }) {
  const id = params.id;
  const demo = DEMO[id];
  if (!demo) notFound();

  const onto = await createOntology();
  const corridor = await onto.corridors.get(id);
  const gateway = await onto.corridors.gatewayActivity();
  const row = gateway.data.find((g) => g.corridor_id === id);
  const live = row !== undefined;
  const objectRef = `object · corridor:${id}`;
  const status: ProfileData["status"] = live ? "live" : "demo";

  const callsValue = live ? row!.port_calls_30d.toLocaleString("en-US") : "20";
  const tonsValue = live ? Math.round(row!.throughput_tons_30d).toLocaleString("en-US") : "280";

  const data: ProfileData = {
    name: corridor?.name ?? demo.name,
    id,
    meta: [`id: corridor:${id}`, `${demo.originName} → ${demo.destinationName}`, demo.countries.join(" · ")],
    status,
    sourceLabel: "PortWatch (gateway)",
    confidence: live ? 0.85 : 0.5,
    relationships: [
      { kind: "gateway port", label: demo.originName, href: `/ontology/port/${demo.originPortId}` },
      { kind: "destination", label: demo.destinationName },
      ...demo.countries.map((c) => ({ kind: "country", label: c })),
    ],
    metrics: [
      {
        name: "Corridor Performance Index", value: "B+", tone: "ok",
        evidence: { metric: "Corridor Performance Index", value: "B+", objectRef, asOf: ASOF, confidence: 0.5, status: "demo",
          lineage: [
            { zone: "bronze", title: "PortWatch + trade feeds", locator: "pillar/port_activity", detail: "Gateway port activity and trade estimates.", sources: ["portwatch"] },
            { zone: "silver", title: "Attribute to corridor", locator: "port_activity_daily", detail: "Joined via ont_corridor.origin_port_id (ontology link).", sources: ["ontology link"] },
            { zone: "gold", title: "Corridor Performance Index", locator: "gold_corridor_performance*", detail: "Composite of throughput, transit time, cost. Mart not yet built.", sources: ["composite", "planned"] },
          ],
          recommendation: "Track customs digitisation progress — it's the fastest lever on transit time." },
      },
      {
        name: "Gateway port calls (30d)", value: callsValue, tone: "plain",
        evidence: { metric: "Gateway port calls (30 days)", value: callsValue, objectRef, asOf: ASOF, confidence: live ? 0.9 : 0.4, status,
          lineage: [
            { zone: "bronze", title: "IMF PortWatch daily feed", locator: "pillar/port_activity", detail: "Daily port calls at the coastal gateway port.", sources: ["portwatch"] },
            { zone: "silver", title: "Normalise & ontology-key", locator: "port_activity_daily", detail: "Resolved to the canonical gateway port.", sources: ["ontology-keyed"] },
            { zone: "gold", title: "Corridor gateway activity", locator: "gold_corridor_gateway_activity", detail: "30-day rolling calls at the gateway, attributed to this corridor.", sources: live ? ["live mart"] : ["demo"] },
          ] },
      },
      {
        name: "Gateway throughput (30d)", value: `${tonsValue} t`, tone: "plain",
        evidence: { metric: "Gateway throughput (30 days)", value: `${tonsValue} tonnes`, objectRef, asOf: ASOF, confidence: live ? 0.85 : 0.4, status,
          lineage: [
            { zone: "bronze", title: "IMF PortWatch daily feed", locator: "pillar/port_activity", detail: "Import + export tonnage estimates at the gateway port.", sources: ["portwatch"] },
            { zone: "silver", title: "Normalise & ontology-key", locator: "port_activity_daily", detail: "Resolved to the canonical gateway port.", sources: ["ontology-keyed"] },
            { zone: "gold", title: "Corridor gateway activity", locator: "gold_corridor_gateway_activity", detail: "Import+export tons at the gateway, attributed to this corridor. Honestly scoped as gateway throughput, not end-to-end corridor flow.", sources: live ? ["live mart"] : ["demo"] },
          ],
          recommendation: "This is gateway-port throughput, not verified end-to-end corridor flow — a port serves multiple corridors." },
      },
    ],
    timeline: [
      { time: "07 Jul · 06:30 UTC", text: `${demo.originName} PortWatch activity ingested → Bronze (checksummed)` },
      { time: "02 Jul", text: "Corridor gateway activity mart refreshed" },
    ],
    aiSummary:
      `The ${demo.name} corridor runs from ${demo.originName}'s coastal gateway to ${demo.destinationName}. Gateway throughput is a proxy for corridor activity — true end-to-end flow (transit time, customs dwell, landed cost) needs the Customs and Rail data products, both deferred. Treat the Corridor Performance Index as illustrative until those land.`,
  };

  return <ObjectProfile data={data} objectTypeLabel="Trade Corridor" iconPath={CORRIDOR_ICON} />;
}

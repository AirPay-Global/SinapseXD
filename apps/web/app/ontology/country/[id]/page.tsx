import { notFound } from "next/navigation";
import { createOntology } from "@/lib/ontology/sdk";
import { ObjectProfile, type ProfileData } from "@/components/ontology/object-profile";

const ASOF = "as of 07 Jul 2026, 14:20 UTC";
const COUNTRY_ICON = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18";

// Demo fallback so a profile always renders before the pipeline/auth is live.
const DEMO: Record<string, { name: string; iso2: string; rec: string; portId?: string; portName?: string }> = {
  zaf: { name: "South Africa", iso2: "ZA", rec: "SADC", portId: "durban", portName: "Durban" },
  ken: { name: "Kenya", iso2: "KE", rec: "EAC", portId: "mombasa", portName: "Mombasa" },
  nga: { name: "Nigeria", iso2: "NG", rec: "ECOWAS", portId: "lagos", portName: "Lagos (Apapa)" },
  tgo: { name: "Togo", iso2: "TG", rec: "ECOWAS", portId: "lome", portName: "Lomé" },
  dji: { name: "Djibouti", iso2: "DJ", rec: "COMESA", portId: "djibouti", portName: "Djibouti" },
  tza: { name: "Tanzania", iso2: "TZ", rec: "EAC", portId: "dar", portName: "Dar es Salaam" },
  gha: { name: "Ghana", iso2: "GH", rec: "ECOWAS", portId: "tema", portName: "Tema" },
};

export default async function CountryProfile({ params }: { params: { id: string } }) {
  const iso3 = params.id.toUpperCase();
  const demo = DEMO[params.id.toLowerCase()];
  if (!demo) notFound();

  const onto = await createOntology();
  const country = await onto.countries.get(iso3);
  const ports = await onto.countries.ports(iso3);
  const live = country !== null;

  const objectRef = `object · country:${iso3}`;
  const status: ProfileData["status"] = live ? "live" : "demo";

  const data: ProfileData = {
    name: country?.name ?? demo.name,
    id: iso3,
    meta: [`id: country:${iso3}`, `ISO2 ${country?.iso2 ?? demo.iso2}`, `REC ${country?.rec ?? demo.rec}`],
    status,
    sourceLabel: "Ontology",
    confidence: live ? 0.95 : 0.5,
    relationships: [
      ...(ports.length > 0
        ? ports.map((p) => ({ kind: "port", label: p.name, href: `/ontology/port/${p.id}` }))
        : demo.portId
          ? [{ kind: "port", label: demo.portName!, href: `/ontology/port/${demo.portId}` }]
          : []),
      { kind: "REC", label: country?.rec ?? demo.rec },
      { kind: "corridors", label: "AfCFTA pilot corridors" },
    ],
    metrics: [
      {
        name: "Country Competitiveness Index", value: "71.2", tone: "ok",
        evidence: { metric: "Country Competitiveness Index", value: "71.2 / 100", objectRef, asOf: ASOF, confidence: 0.55, status: "demo",
          lineage: [
            { zone: "bronze", title: "Federated pillar feeds", locator: "pillar/*", detail: "Trade, port activity, financial and SDG feeds for the country.", sources: ["federated"] },
            { zone: "silver", title: "Country aggregation", locator: "country_aggregate*", detail: "Rolled up from port + corridor + trade Silver tables.", sources: ["ontology-keyed"] },
            { zone: "gold", title: "Country Competitiveness Index", locator: "gold_country_competitiveness*", detail: "Composite score. Mart not yet built.", sources: ["composite", "planned"] },
          ],
          recommendation: "Track alongside the gateway port's Congestion Score — they move together." },
      },
      {
        name: "Ports (live)", value: String(ports.length || (demo.portId ? 1 : 0)), tone: "plain",
        evidence: { metric: "Ports in country", value: String(ports.length || (demo.portId ? 1 : 0)), objectRef, asOf: ASOF, confidence: live ? 0.95 : 0.5, status,
          lineage: [
            { zone: "bronze", title: "Ontology seed", locator: "ont_port", detail: "Canonical port registry, seeded per pilot country.", sources: ["ontology"] },
            { zone: "silver", title: "Link resolution", locator: "ont_port.country_iso3", detail: "Ports joined to this country via the ontology link.", sources: ["ontology-keyed"] },
            { zone: "gold", title: "Ports (live)", locator: "ont_port", detail: "Direct count, not an aggregate mart.", sources: ["live"] },
          ] },
      },
      {
        name: "AfCFTA member", value: (country?.isAfcftaMember ?? true) ? "Yes" : "No", tone: "ok",
        evidence: { metric: "AfCFTA membership", value: (country?.isAfcftaMember ?? true) ? "Yes" : "No", objectRef, asOf: ASOF, confidence: 0.95, status,
          lineage: [
            { zone: "bronze", title: "Ontology seed", locator: "ont_country", detail: "AfCFTA membership flag, seeded from treaty ratification records.", sources: ["ontology"] },
            { zone: "silver", title: "—", locator: "ont_country", detail: "No transform — direct field.", sources: ["ontology-keyed"] },
            { zone: "gold", title: "AfCFTA member", locator: "ont_country", detail: "Direct read.", sources: ["live"] },
          ] },
      },
    ],
    timeline: [
      { time: "07 Jul · 06:30 UTC", text: "Gateway port activity ingested → Bronze (checksummed)" },
      { time: "01 Jul", text: `${country?.rec ?? demo.rec} intra-REC trade share updated` },
    ],
    aiSummary:
      `${demo.name} anchors its AfCFTA corridor participation through ${demo.portName ?? "its gateway port"}. Country-level scoring composites (competitiveness, trade cost) are planned Gold marts — today's confidence reflects that ports and REC membership are live, but the composite index is illustrative.`,
    healthScore: 71,
    recommendations: [
      { text: `Track the gateway port's Congestion Score alongside the competitiveness index — they move together.`, confidence: 0.6 },
      { text: `Lift AfCFTA preferential utilisation on ${demo.rec} corridors — the fastest trade-cost lever available.`, confidence: 0.57 },
    ],
  };

  return <ObjectProfile data={data} objectTypeLabel="Country" iconPath={COUNTRY_ICON} />;
}

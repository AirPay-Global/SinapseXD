import { createOntology } from "@/lib/ontology/sdk";
import { PORTS } from "@/lib/demo-data";
import type { PortOption } from "@/components/port-selector";
import { berthsForPort, occupancyForPort, tracksForPort } from "@/lib/satellite/demo";
import { SatelliteView } from "./satellite-view";

/**
 * Satellite Intelligence home (spec §5, §17 MVP). Server component: resolves
 * the port registry from the ontology (grows automatically as ports are
 * seeded), demo list as fallback, and the selected port via ?port=. The
 * berths, tracks and occupancy are demo-generated and provenance-tagged — no
 * live satellite/imagery pipeline exists yet, and the UI never hides that.
 */
export default async function SatellitePage({ searchParams }: { searchParams: { port?: string } }) {
  const onto = await createOntology();
  const livePorts = await onto.ports.list();
  const liveCountries = livePorts.length ? await onto.countries.list() : [];
  const ports: PortOption[] = livePorts.length
    ? livePorts.map((p) => ({ id: p.id, name: p.name, country: liveCountries.find((c) => c.id === p.countryId)?.name ?? p.countryId }))
    : PORTS.map((p) => ({ id: p.id, name: p.name, country: p.country }));

  const port = ports.find((p) => p.id === searchParams.port) ?? ports[0];

  const berths = berthsForPort(port.id);
  const tracks = tracksForPort(port.id);
  const occupancy = occupancyForPort(port.id, berths);

  return <SatelliteView port={port} ports={ports} seedBerths={berths} tracks={tracks} occupancy={occupancy} />;
}

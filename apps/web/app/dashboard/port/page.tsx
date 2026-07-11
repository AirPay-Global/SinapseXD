import { demoFeed } from "@/lib/feed";
import { createOntology } from "@/lib/ontology/sdk";
import { pivotThroughput } from "@/lib/ontology/types";
import { COMMODITIES, PORTS, portKpis, throughputByCommodity, vesselQueue } from "@/lib/demo-data";
import type { PortOption } from "@/components/port-selector";
import { PortView } from "./port-view";

export default async function PortDashboard({ searchParams }: { searchParams: { port?: string } }) {
  const onto = await createOntology();

  // Port registry: ontology first (grows automatically as ont_port is
  // seeded), demo list only when the DB is unreachable. Country names for
  // live ports come from the country link; fall back to the ISO3 code.
  const livePorts = await onto.ports.list();
  const liveCountries = livePorts.length ? await onto.countries.list() : [];
  const ports: Array<PortOption & { lat: number; lng: number }> = livePorts.length
    ? livePorts.map((p) => ({
        id: p.id,
        name: p.name,
        country: liveCountries.find((c) => c.id === p.countryId)?.name ?? p.countryId,
        lat: p.lat,
        lng: p.lng,
      }))
    : PORTS.map((p) => ({ id: p.id, name: p.name, country: p.country, lat: p.lat, lng: p.lng }));

  // Selection via ?port= — unknown/absent ids fall back to the first port,
  // so a stale bookmark never 404s or crashes the view.
  const port = ports.find((p) => p.id === searchParams.port) ?? ports[0];

  // Live PortWatch-backed surfaces — fall back to demo when the mart is empty
  // (DB not provisioned / PORTWATCH_ENABLED off / no auth session).
  const [activity, throughput, vessels, conditions] = await Promise.all([
    onto.ports.activity30d(port.id),
    onto.ports.throughputMonthly(port.id),
    onto.ports.vesselsNear(port.id),
    onto.ports.conditions(port.id),
  ]);

  const portCallsLive = activity.data !== null;
  const portCallsValue = portCallsLive ? activity.data!.port_calls_30d : portKpis(port.id).portCalls30d;

  const pivot = throughput.data.length ? pivotThroughput(throughput.data) : null;

  return (
    <PortView
      port={port}
      ports={ports}
      portCallsValue={portCallsValue}
      portCallsLive={portCallsLive}
      portCallsFeed={portCallsLive ? activity.feed : demoFeed()}
      throughput={{
        data: pivot?.data ?? throughputByCommodity(port.id),
        series: pivot?.series ?? COMMODITIES.map((c) => ({ key: c, label: c })),
        isLive: pivot !== null,
        feed: pivot ? throughput.feed : demoFeed(),
      }}
      vessels={{
        data: vessels.data.length ? vessels.data : vesselQueue(port.id),
        isLive: vessels.data.length > 0,
        feed: vessels.data.length ? vessels.feed : demoFeed(),
      }}
      conditions={{
        data: conditions.data,
        isLive: conditions.data !== null,
        feed: conditions.data ? conditions.feed : demoFeed(),
      }}
    />
  );
}

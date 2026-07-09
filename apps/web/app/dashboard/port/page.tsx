import { demoFeed } from "@/lib/feed";
import { createOntology } from "@/lib/ontology/sdk";
import { pivotThroughput } from "@/lib/ontology/types";
import { COMMODITIES, PORTS, portKpis, throughputByCommodity, vesselQueue } from "@/lib/demo-data";
import { PortView } from "./port-view";

export default async function PortDashboard() {
  const port = PORTS[0]; // Durban — port selector wires in with auth/orgs
  const onto = await createOntology();

  // Live PortWatch-backed surfaces — fall back to demo when the mart is empty
  // (DB not provisioned / PORTWATCH_ENABLED off / no auth session).
  const [activity, throughput, vessels] = await Promise.all([
    onto.ports.activity30d(port.id),
    onto.ports.throughputMonthly(port.id),
    onto.ports.vesselsNear(port.id),
  ]);

  const portCallsLive = activity.data !== null;
  const portCallsValue = portCallsLive ? activity.data!.port_calls_30d : portKpis(port.id).portCalls30d;

  const pivot = throughput.data.length ? pivotThroughput(throughput.data) : null;

  return (
    <PortView
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
    />
  );
}

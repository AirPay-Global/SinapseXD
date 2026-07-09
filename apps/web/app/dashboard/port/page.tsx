import { demoFeed } from "@/lib/feed";
import { getPortActivity30d, getPortThroughputMonthly, pivotThroughput } from "@/lib/gold";
import { COMMODITIES, PORTS, portKpis, throughputByCommodity } from "@/lib/demo-data";
import { PortView } from "./port-view";

export default async function PortDashboard() {
  const port = PORTS[0]; // Durban — port selector wires in with auth/orgs

  // Live PortWatch-backed surfaces — fall back to demo when the mart is empty
  // (DB not provisioned / PORTWATCH_ENABLED off / no auth session).
  const [activity, throughput] = await Promise.all([
    getPortActivity30d(port.id),
    getPortThroughputMonthly(port.id),
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
    />
  );
}

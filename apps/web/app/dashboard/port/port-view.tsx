"use client";

import type { PillarFeed } from "@sinapse/shared";
import { PageHeader } from "@/components/app-shell";
import { StackedBars, TrendLines } from "@/components/charts/charts";
import { InsightPanel } from "@/components/intelligence/insight-panel";
import { VesselMap } from "@/components/maps/vessel-map";
import { ChartCard, HeroStat, StatCard } from "@/components/ui/stat-card";
import { demoFeed } from "@/lib/feed";
import { quickEvidence } from "@/lib/evidence/build";
import { PORTS, marineConditions, portCalls30d, portKpis, vesselQueue } from "@/lib/demo-data";

const nf = new Intl.NumberFormat("en-US");

export interface PortViewProps {
  portCallsValue: number;
  portCallsLive: boolean;
  portCallsFeed: PillarFeed;
  throughput: {
    data: Array<Record<string, number | string>>;
    series: Array<{ key: string; label: string }>;
    isLive: boolean;
    feed: PillarFeed;
  };
  vessels: {
    data: import("@sinapse/shared").VesselPosition[];
    isLive: boolean;
    feed: PillarFeed;
  };
}

export function PortView({ portCallsValue, portCallsLive, portCallsFeed, throughput, vessels }: PortViewProps) {
  const port = PORTS[0]; // Durban — port selector wires in with auth/orgs
  const kpis = portKpis(port.id);
  const queue = (vessels.data.length ? vessels.data : vesselQueue(port.id)).slice(0, 8);
  const conditions = marineConditions().find((c) => c.portId === port.id)!;

  // Port calls / throughput can be live via PortWatch marts; the anchorage
  // KPI is still a demo estimate until a congestion mart is built.
  const aisFeed = demoFeed();

  return (
    <>
      <PageHeader
        title={`Port Operations — ${port.name}`}
        subtitle="Live intelligence from AIS, weather, and trade pillars"
      />

      {/* Hero: the operational headline — anchorage pressure — leads the view,
          supporting KPIs sit at a lower weight beside it. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <HeroStat
          label="Avg anchorage wait"
          value={String(kpis.avgWaitHours)}
          unit="hours"
          delta={{ text: "1.8h vs prior 30d", direction: "down", positive: true }}
          context={`${kpis.vesselsInbound} vessels inbound · next arrival in 2h`}
          feed={aisFeed}
          evidence={quickEvidence({ metric: "Avg anchorage wait", value: `${kpis.avgWaitHours} hours`, objectRef: "object · port:durban", confidence: 0.74, status: "demo", pillar: "AIS & Vessels", source: "ais", gold: "gold_port_congestion*", recommendation: "Shift two Panamax windows off the Thursday swell peak to hold wait under 18h." })}
        />
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
          <StatCard
            label="Port calls (30 days)"
            value={nf.format(portCallsValue)}
            delta={portCallsLive ? undefined : { text: "4.2% vs prior 30d", direction: "up", positive: true }}
            subtitle={portCallsLive ? port.name : undefined}
            feed={portCallsFeed}
            evidence={quickEvidence({ metric: "Port calls (30 days)", value: nf.format(portCallsValue), objectRef: "object · port:durban", confidence: portCallsLive ? 0.95 : 0.4, status: portCallsLive ? "live" : "demo", pillar: "Port Activity", source: "portwatch", silver: "port_activity_daily", gold: "gold_port_activity_30d" })}
          />
          <StatCard label="Vessels inbound" value={String(vessels.isLive ? vessels.data.length : kpis.vesselsInbound)} subtitle={vessels.isLive ? "Live AIS positions" : "Next arrival in 2h"} feed={vessels.feed}
            evidence={quickEvidence({ metric: "Vessels inbound", value: String(vessels.isLive ? vessels.data.length : kpis.vesselsInbound), objectRef: "object · port:durban", confidence: vessels.isLive ? 0.85 : 0.5, status: vessels.isLive ? "live" : "demo", pillar: "AIS & Vessels", source: "ais", silver: "vessel_positions", gold: vessels.isLive ? "vessel_positions (live)" : "gold_vessel_queue*" })}
          />
          <StatCard
            label="Throughput (30 days)"
            value={`${nf.format(kpis.throughputTeu30d)} TEU`}
            delta={{ text: "2.9% vs prior 30d", direction: "up", positive: true }}
            feed={aisFeed}
            evidence={quickEvidence({ metric: "Throughput (30 days)", value: `${nf.format(kpis.throughputTeu30d)} TEU`, objectRef: "object · port:durban", confidence: 0.6, status: "demo", pillar: "Port Activity", source: "portwatch", silver: "port_activity_daily", gold: "gold_port_activity_30d" })}
          />
        </div>
      </div>

      <div className="mt-6">
        <InsightPanel insight="Container arrivals at Durban are trending 4% above the 30-day average while anchorage wait times fall — berth productivity gains are absorbing the extra volume. Watch the moderate swell forecast for Thursday: two Panamax arrivals may shift ETAs by 6–10 hours." />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Live vessel picture"
          subtitle={`AIS positions within ±5° of ${port.name} · wave ${conditions.waveHeightM} m · wind ${conditions.windSpeedKn} kn`}
          pillar="AIS & Vessels"
          feed={vessels.feed}
        >
          <VesselMap vessels={queue} center={port} />
        </ChartCard>

        <ChartCard title="Incoming vessel queue" subtitle={vessels.isLive ? "Live AIS, by destination ETA" : "Next 8 arrivals by ETA"} pillar="AIS & Vessels" feed={vessels.feed}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Vessel</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">ETA</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((v) => (
                  <tr key={v.mmsi || v.imo} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-medium text-card-foreground">{v.name}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{v.type}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">
                      {v.etaIso ? v.etaIso.slice(5, 16).replace("T", " ") : "—"}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          v.status === "delayed"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {v.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Port calls — arrivals vs departures" subtitle="Daily, last 30 days" pillar="AIS & Vessels" feed={aisFeed}>
          <TrendLines
            data={portCalls30d(port.id)}
            xKey="date"
            series={[
              { key: "arrivals", label: "Arrivals" },
              { key: "departures", label: "Departures" },
            ]}
          />
        </ChartCard>

        <ChartCard
          title={throughput.isLive ? "Cargo throughput by vessel class" : "Cargo throughput by commodity"}
          subtitle={throughput.isLive ? "Monthly · import + export, metric tonnes" : "Monthly, thousand tonnes"}
          pillar={throughput.isLive ? "IMF PortWatch" : "Trade Analytics"}
          feed={throughput.feed}
        >
          <StackedBars
            data={throughput.data}
            xKey="month"
            series={throughput.series}
            yFormatter={(v) => nf.format(v)}
          />
        </ChartCard>
      </div>
    </>
  );
}

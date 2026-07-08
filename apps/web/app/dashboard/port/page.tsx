"use client";



import { PageHeader } from "@/components/app-shell";
import { StackedBars, TrendLines } from "@/components/charts/charts";
import { InsightPanel } from "@/components/intelligence/insight-panel";
import { VesselMap } from "@/components/maps/vessel-map";
import { ChartCard, HeroStat, StatCard } from "@/components/ui/stat-card";
import { liveFeed } from "@/lib/feed";
import {
  COMMODITIES,
  PORTS,
  marineConditions,
  portCalls30d,
  portKpis,
  throughputByCommodity,
  vesselQueue,
} from "@/lib/demo-data";

const nf = new Intl.NumberFormat("en-US");

export default function PortDashboard() {
  const port = PORTS[0]; // Durban — port selector wires in with auth/orgs
  const kpis = portKpis(port.id);
  const queue = vesselQueue(port.id).slice(0, 8);
  const conditions = marineConditions().find((c) => c.portId === port.id)!;
  const aisFeed = liveFeed();
  const tradeFeed = liveFeed();

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
        />
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
          <StatCard
            label="Port calls (30 days)"
            value={nf.format(kpis.portCalls30d)}
            delta={{ text: "4.2% vs prior 30d", direction: "up", positive: true }}
          />
          <StatCard
            label="Vessels inbound"
            value={String(kpis.vesselsInbound)}
            subtitle="Next arrival in 2h"
          />
          <StatCard
            label="Throughput (30 days)"
            value={`${nf.format(kpis.throughputTeu30d)} TEU`}
            delta={{ text: "2.9% vs prior 30d", direction: "up", positive: true }}
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
          feed={aisFeed}
        >
          <VesselMap vessels={vesselQueue(port.id)} center={port} />
        </ChartCard>

        <ChartCard title="Incoming vessel queue" subtitle="Next 8 arrivals by ETA" pillar="AIS & Vessels" feed={aisFeed}>
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
                  <tr key={v.imo} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-medium text-card-foreground">{v.name}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{v.type}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">
                      {v.etaIso.slice(5, 16).replace("T", " ")}
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

        <ChartCard title="Cargo throughput by commodity" subtitle="Monthly, thousand tonnes" pillar="Trade Analytics" feed={tradeFeed}>
          <StackedBars
            data={throughputByCommodity(port.id)}
            xKey="month"
            series={COMMODITIES.map((c) => ({ key: c, label: c }))}
            yFormatter={(v) => nf.format(v)}
          />
        </ChartCard>
      </div>
    </>
  );
}

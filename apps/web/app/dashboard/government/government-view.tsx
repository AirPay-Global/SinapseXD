"use client";

import type { PillarFeed } from "@sinapse/shared";
import { PageHeader } from "@/components/app-shell";
import { RankedBars, TrendLines } from "@/components/charts/charts";
import { InsightPanel } from "@/components/intelligence/insight-panel";
import { ChartCard, HeroStat, StatCard } from "@/components/ui/stat-card";
import { demoFeed } from "@/lib/feed";
import type { CorridorGateway } from "@/lib/gold";
import { FREIGHT_ROUTES, corridorFlows, freightRates90d } from "@/lib/demo-data";

const nf = new Intl.NumberFormat("en-US");
const usd = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`);

export function GovernmentView({
  corridor,
}: {
  corridor: { data: CorridorGateway[]; feed: PillarFeed };
}) {
  const flows = corridorFlows().sort((a, b) => b.throughputTeu - a.throughputTeu);
  const totalValue = flows.reduce((s, f) => s + f.tradeValueUsd, 0);
  const avgTransit = (flows.reduce((s, f) => s + f.avgTransitDays, 0) / flows.length).toFixed(1);

  // Freight rates: one row per date, one column per route.
  const rates = freightRates90d();
  const byDate = new Map<string, Record<string, unknown>>();
  for (const r of rates) {
    const row = byDate.get(r.dateIso) ?? { date: r.dateIso };
    row[r.route] = r.rateUsdPerFeu;
    byDate.set(r.dateIso, row);
  }
  const rateRows = [...byDate.values()];

  const corridorLive = corridor.data.length > 0;
  const corridorBars = corridorLive
    ? corridor.data.map((c) => ({ corridor: c.corridor_name, tons: c.throughput_tons_30d }))
    : flows;

  return (
    <>
      <PageHeader
        title="Government & Policy"
        subtitle="Corridor performance, trade costs, and AfCFTA compliance signals"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <HeroStat
          label="Avg corridor transit"
          value={avgTransit}
          unit="days"
          delta={{ text: "0.9 days YoY", direction: "down", positive: true }}
          context={`${flows.length} pilot corridors · June 2026`}
          feed={demoFeed()}
        />
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
          <StatCard label="Monitored corridors" value={String(flows.length)} subtitle="7 pilot corridors" feed={demoFeed()} />
          <StatCard
            label="Corridor trade value"
            value={usd(totalValue)}
            delta={{ text: "6.1% YoY", direction: "up", positive: true }}
            feed={demoFeed()}
          />
          <StatCard
            label="Trade cost index (SDG 10)"
            value="82.4"
            subtitle="2019 = 100 · lower is better"
            feed={demoFeed()}
          />
        </div>
      </div>

      <div className="mt-6">
        <InsightPanel insight="The Djibouti–Addis Ababa corridor shows the strongest quarter-on-quarter transit improvement (−1.4 days) following customs digitisation at Galafi. Freight rates on Asia–East Africa lanes have softened 8% over 90 days — an opening to negotiate long-term contract rates for strategic imports." />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title={corridorLive ? "Corridor gateway throughput" : "Corridor throughput"}
          subtitle={corridorLive ? "30-day tonnes at the coastal gateway port" : "TEU, June 2026"}
          pillar={corridorLive ? "IMF PortWatch" : "Trade Analytics"}
          feed={corridorLive ? corridor.feed : demoFeed()}
        >
          <RankedBars
            data={corridorBars}
            nameKey="corridor"
            valueKey={corridorLive ? "tons" : "throughputTeu"}
            valueLabel={corridorLive ? "Gateway throughput (t, 30d)" : "Throughput (TEU)"}
            formatter={(v) => nf.format(v)}
            height={300}
          />
        </ChartCard>

        <ChartCard title="Container freight rates" subtitle="USD per FEU, last 90 days (FBX)" pillar="Market Intel" feed={demoFeed()}>
          <TrendLines
            data={rateRows}
            xKey="date"
            series={FREIGHT_ROUTES.map((r) => ({ key: r, label: r }))}
            yFormatter={(v) => `$${nf.format(v)}`}
            height={300}
          />
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard title="Corridor scorecard" subtitle="Throughput, value, and transit time by corridor" pillar="Trade Analytics" feed={demoFeed()}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Corridor</th>
                  <th className="pb-2 pr-4 font-medium">Origin → Destination</th>
                  <th className="pb-2 pr-4 text-right font-medium">TEU</th>
                  <th className="pb-2 pr-4 text-right font-medium">Trade value</th>
                  <th className="pb-2 text-right font-medium">Transit (days)</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((f) => (
                  <tr key={f.corridor} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-medium text-card-foreground">{f.corridor}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {f.originCountry} → {f.destinationCountry}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{nf.format(f.throughputTeu)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{usd(f.tradeValueUsd)}</td>
                    <td className="py-2.5 text-right tabular-nums">{f.avgTransitDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </>
  );
}

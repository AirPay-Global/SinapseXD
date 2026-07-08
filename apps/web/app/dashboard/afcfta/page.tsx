"use client";



import { PageHeader } from "@/components/app-shell";
import { GroupedBars, RankedBars } from "@/components/charts/charts";
import { InsightPanel } from "@/components/intelligence/insight-panel";
import { ChartCard, HeroStat, StatCard } from "@/components/ui/stat-card";
import { liveFeed } from "@/lib/feed";
import { corridorFlows } from "@/lib/demo-data";

const nf = new Intl.NumberFormat("en-US");

// Intra-AfCFTA trade share by REC — placeholder for StatAfrica feed
const REC_TRADE = [
  { rec: "SADC", intra2024: 21.4, intra2025: 23.1 },
  { rec: "ECOWAS", intra2024: 11.2, intra2025: 12.6 },
  { rec: "EAC", intra2024: 18.9, intra2025: 20.3 },
  { rec: "COMESA", intra2024: 9.8, intra2025: 10.9 },
  { rec: "ECCAS", intra2024: 4.1, intra2025: 4.6 },
];

export default function AfcftaDashboard() {
  const flows = corridorFlows().sort((a, b) => b.tradeValueUsd - a.tradeValueUsd);
  const tradeFeed = liveFeed();

  return (
    <>
      <PageHeader
        title="AfCFTA Trade Monitoring"
        subtitle="Continental flows, Digital Trade Protocol compliance, and inclusion metrics"
      />

      {/* Hero: intra-African trade share is the AfCFTA headline — the
          treaty's success metric. Supporting KPIs sit beside it. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <HeroStat
          label="Intra-African trade share"
          value="16.8"
          unit="%"
          delta={{ text: "1.3 pts YoY", direction: "up", positive: true }}
          context="of total African trade · AfCFTA target 25% by 2030"
          feed={tradeFeed}
        />
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
          <StatCard label="States trading under AfCFTA" value="47 / 55" subtitle="Guided Trade Initiative + full" />
          <StatCard
            label="Digital Trade Protocol"
            value="31"
            subtitle="member states with aligned data standards"
          />
          <StatCard
            label="Landlocked corridor volume"
            value="+9.4%"
            subtitle="YoY, corridors serving landlocked economies"
          />
        </div>
      </div>

      <div className="mt-6">
        <InsightPanel insight="Corridors serving landlocked economies grew 9.4% year on year — twice the continental average — led by Djibouti–Addis and Lomé–Ouagadougou. EAC and SADC continue to post the highest intra-REC trade shares; ECCAS remains the inclusion gap, flagged for the next APRM monitoring cycle." />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Intra-REC trade share" subtitle="% of REC trade that is intra-African, 2024 vs 2025" pillar="Trade Analytics" feed={tradeFeed}>
          <GroupedBars
            data={REC_TRADE}
            xKey="rec"
            series={[
              { key: "intra2024", label: "2024" },
              { key: "intra2025", label: "2025" },
            ]}
            yFormatter={(v) => `${v}%`}
            height={300}
          />
        </ChartCard>

        <ChartCard title="Corridor trade value" subtitle="USD, June 2026" pillar="Trade Analytics" feed={tradeFeed}>
          <RankedBars
            data={flows.map((f) => ({ ...f, valueBn: Math.round(f.tradeValueUsd / 1e7) / 100 }))}
            nameKey="corridor"
            valueKey="valueBn"
            valueLabel="Trade value ($B)"
            formatter={(v) => `$${nf.format(v)}B`}
            height={300}
          />
        </ChartCard>
      </div>
    </>
  );
}

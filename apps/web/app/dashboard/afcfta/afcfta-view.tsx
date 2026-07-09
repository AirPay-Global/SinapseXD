"use client";

import type { PillarFeed } from "@sinapse/shared";
import { PageHeader } from "@/components/app-shell";
import { GroupedBars, RankedBars } from "@/components/charts/charts";
import { InsightPanel } from "@/components/intelligence/insight-panel";
import { ChartCard, HeroStat, StatCard } from "@/components/ui/stat-card";
import { demoFeed } from "@/lib/feed";
import { quickEvidence } from "@/lib/evidence/build";
import type { CorridorGateway } from "@/lib/ontology/types";
import { corridorFlows } from "@/lib/demo-data";

const nf = new Intl.NumberFormat("en-US");

// Intra-AfCFTA trade share by REC — placeholder for a StatAfrica feed.
const REC_TRADE = [
  { rec: "SADC", intra2024: 21.4, intra2025: 23.1 },
  { rec: "ECOWAS", intra2024: 11.2, intra2025: 12.6 },
  { rec: "EAC", intra2024: 18.9, intra2025: 20.3 },
  { rec: "COMESA", intra2024: 9.8, intra2025: 10.9 },
  { rec: "ECCAS", intra2024: 4.1, intra2025: 4.6 },
];

export function AfcftaView({
  corridor,
}: {
  corridor: { data: CorridorGateway[]; feed: PillarFeed };
}) {
  const flows = corridorFlows().sort((a, b) => b.tradeValueUsd - a.tradeValueUsd);

  const corridorLive = corridor.data.length > 0;
  const corridorBars = corridorLive
    ? corridor.data.map((c) => ({ corridor: c.corridor_name, tons: c.throughput_tons_30d }))
    : flows.map((f) => ({ ...f, valueBn: Math.round(f.tradeValueUsd / 1e7) / 100 }));

  return (
    <>
      <PageHeader
        title="AfCFTA Trade Monitoring"
        subtitle="Continental flows, Digital Trade Protocol compliance, and inclusion metrics"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <HeroStat
          label="Intra-African trade share"
          value="16.8"
          unit="%"
          delta={{ text: "1.3 pts YoY", direction: "up", positive: true }}
          context="of total African trade · AfCFTA target 25% by 2030"
          feed={demoFeed()}
          evidence={quickEvidence({ metric: "Intra-African trade share", value: "16.8%", objectRef: "object · Africa (55 states)", confidence: 0.5, status: "demo", pillar: "Trade Analytics", source: "comtrade", gold: "gold_intra_africa_share*", recommendation: "Close the ECCAS inclusion gap to lift the continental share toward the 2030 target." })}
        />
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
          <StatCard label="States trading under AfCFTA" value="47 / 55" subtitle="Guided Trade Initiative + full" feed={demoFeed()}
            evidence={quickEvidence({ metric: "States trading under AfCFTA", value: "47 / 55", objectRef: "object · countries", confidence: 0.6, status: "demo", pillar: "Trade Analytics", source: "afcfta", gold: "gold_afcfta_participation*" })}
          />
          <StatCard label="Digital Trade Protocol" value="31" subtitle="member states with aligned data standards" feed={demoFeed()}
            evidence={quickEvidence({ metric: "Digital Trade Protocol alignment", value: "31 states", objectRef: "policy · DTP 2024", confidence: 0.5, status: "demo", pillar: "Governance", source: "afcfta", gold: "gold_dtp_alignment*" })}
          />
          <StatCard label="Landlocked corridor volume" value="+9.4%" subtitle="YoY, landlocked-serving corridors" feed={demoFeed()}
            evidence={quickEvidence({ metric: "Landlocked corridor volume", value: "+9.4% YoY", objectRef: "object · corridors (landlocked)", confidence: 0.65, status: "demo", pillar: "Port Activity", source: "portwatch", silver: "port_activity_daily", gold: "gold_corridor_gateway_activity" })}
          />
        </div>
      </div>

      <div className="mt-6">
        <InsightPanel insight="Corridors serving landlocked economies grew 9.4% year on year — twice the continental average — led by Djibouti–Addis and Lomé–Ouagadougou. EAC and SADC continue to post the highest intra-REC trade shares; ECCAS remains the inclusion gap, flagged for the next APRM monitoring cycle." />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Intra-REC trade share" subtitle="% of REC trade that is intra-African, 2024 vs 2025" pillar="Trade Analytics" feed={demoFeed()}>
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

        <ChartCard
          title={corridorLive ? "Corridor gateway throughput" : "Corridor trade value"}
          subtitle={corridorLive ? "30-day tonnes at the coastal gateway port" : "USD, June 2026"}
          pillar={corridorLive ? "IMF PortWatch" : "Trade Analytics"}
          feed={corridorLive ? corridor.feed : demoFeed()}
        >
          <RankedBars
            data={corridorBars}
            nameKey="corridor"
            valueKey={corridorLive ? "tons" : "valueBn"}
            valueLabel={corridorLive ? "Gateway throughput (t, 30d)" : "Trade value ($B)"}
            formatter={(v) => (corridorLive ? nf.format(v) : `$${nf.format(v)}B`)}
            height={300}
          />
        </ChartCard>
      </div>
    </>
  );
}

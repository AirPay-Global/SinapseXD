"use client";



import { PageHeader } from "@/components/app-shell";
import { TargetBars, TrendLines } from "@/components/charts/charts";
import { InsightPanel } from "@/components/intelligence/insight-panel";
import { ChartCard, StatCard } from "@/components/ui/stat-card";
import { revenueVsForecast, sdgIndicators } from "@/lib/demo-data";

const usd = (v: number) => `$${(v / 1e6).toFixed(1)}M`;

export default function DfiDashboard() {
  const sdg = sdgIndicators();
  const revenue = revenueVsForecast();

  return (
    <>
      <PageHeader
        title="DFI Investment Intelligence"
        subtitle="Impact measurement and infrastructure ROI across SDG 8 / 9 / 10 / 17"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Port revenue (FY to date)"
          value="$46.2M"
          delta={{ text: "3.4% vs forecast", direction: "up", positive: true }}
        />
        <StatCard label="Infrastructure utilisation" value="71%" subtitle="Weighted across 7 pilot ports" />
        <StatCard
          label="SDG indicators on track"
          value={`${sdg.filter((s) => s.value / s.target >= 0.6).length} / ${sdg.length}`}
          subtitle="≥60% of 2030 target"
        />
        <StatCard
          label="Blended finance signals"
          value="4"
          subtitle="Corridors with rising volume + capacity gap"
        />
      </div>

      <div className="mt-6">
        <InsightPanel insight="Freight volume growth (SDG 9.1.2) is running ahead of berth capacity investment on the Northern and Central corridors — a quantifiable case for blended-finance berth expansion at Mombasa and Dar es Salaam. Zero-tariff coverage for LDC imports (SDG 10.a.1) rose 3 points this year, the fastest mover in the basket." />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Port revenue vs forecast" subtitle="Monthly USD, trailing 12 months" pillar="Financial Data">
          <TrendLines
            data={revenue}
            xKey="month"
            series={[
              { key: "actualUsd", label: "Actual" },
              { key: "forecastUsd", label: "Forecast" },
            ]}
            yFormatter={usd}
            height={300}
          />
        </ChartCard>

        <ChartCard title="SDG progress to 2030 targets" subtitle="AfCFTA aggregate · colour = goal (8 blue · 9 teal · 10 amber · 17 violet)" pillar="SDG Reporting">
          <TargetBars
            data={sdg.map((s) => ({ label: `${s.indicatorCode} ${s.label}`, value: s.value, target: s.target, goal: s.goal }))}
            height={300}
          />
        </ChartCard>
      </div>
    </>
  );
}

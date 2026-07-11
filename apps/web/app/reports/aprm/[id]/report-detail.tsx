"use client";

import Link from "next/link";
import type { AprmReportRow } from "@/lib/reporting/aprm-report";

const STATUS_TEXT: Record<string, string> = { live: "text-success", demo: "text-warning" };
const STATUS_VAR: Record<string, string> = { live: "var(--success)", demo: "var(--warning)" };

function Tag({ live }: { live: boolean }) {
  const key = live ? "live" : "demo";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase ${STATUS_TEXT[key]}`}
      style={{ background: `color-mix(in srgb, ${STATUS_VAR[key]} 15%, transparent)` }}
    >
      {key}
    </span>
  );
}

const GOAL_LABEL: Record<number, string> = { 8: "Decent Work & Growth", 9: "Industry & Infrastructure", 10: "Reduced Inequalities", 17: "Partnerships for the Goals" };

export function AprmReportDetail({ report }: { report: AprmReportRow }) {
  const c = report.content_json;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/reports/aprm" className="text-[13px] text-muted-foreground hover:text-foreground">
          ← All reports
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 print:border-0 print:shadow-none">
        <div className="mb-6 border-b border-border pb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Sinapse XD · APRM Monitoring Report</p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-foreground">{report.title ?? report.period}</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Generated {new Date(report.generated_at).toLocaleString()} · period {c.period}</p>
        </div>

        <section className="mb-6">
          <h2 className="mb-2 font-heading text-[15px] font-semibold text-foreground">Executive Summary</h2>
          <p className="text-[13.5px] leading-relaxed text-foreground">{c.narrative}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Narrative source: <Tag live={c.narrativeLive} /> {c.narrativeLive ? " Claude-generated, grounded in the sections below" : " templated summary (Claude not configured in this environment)"}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 font-heading text-[15px] font-semibold text-foreground">SDG Progress — Goals 8, 9, 10, 17</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Goal</th>
                  <th className="pb-2 pr-4 font-medium">Indicator</th>
                  <th className="pb-2 pr-4 text-right font-medium">Value</th>
                  <th className="pb-2 pr-4 text-right font-medium">2030 target</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {c.sdg.map((s) => (
                  <tr key={s.indicatorCode} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted-foreground">SDG {s.goal} · {GOAL_LABEL[s.goal]}</td>
                    <td className="py-2 pr-4 font-medium text-foreground">{s.indicatorCode} {s.label}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{s.value.toFixed(1)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{s.target}</td>
                    <td className="py-2 text-right"><Tag live={s.live} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 font-heading text-[15px] font-semibold text-foreground">Corridor Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Corridor</th>
                  <th className="pb-2 pr-4 text-right font-medium">Gateway calls (30d)</th>
                  <th className="pb-2 pr-4 text-right font-medium">Gateway throughput (30d)</th>
                  <th className="pb-2 pr-4 text-right font-medium">Bilateral trade value</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {c.corridors.map((corr) => (
                  <tr key={corr.corridorId} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium text-foreground">{corr.corridorName}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{corr.gatewayPortCalls30d ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{corr.gatewayThroughputTons30d ? `${Math.round(corr.gatewayThroughputTons30d).toLocaleString()} t` : "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{corr.tradeValueUsdLatest ? `$${(corr.tradeValueUsdLatest / 1e6).toFixed(1)}M` : "—"}</td>
                    <td className="py-2 text-right"><Tag live={corr.live} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-[15px] font-semibold text-foreground">Methodology & Evidence Notes</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-muted-foreground">
            {c.methodology.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { RankedBars, TrendLines } from "@/components/charts/charts";
import { useEvidence } from "@/components/evidence/evidence-drawer";
import type { EvidenceRecord } from "@/lib/evidence/types";
import {
  ANOMALIES,
  BENCHMARK_EVIDENCE,
  BENCHMARK_PORTS,
  BRIEFINGS,
  EARLY_WARNINGS,
  FORECAST_EVIDENCE,
  FORECAST_SERIES,
  IMPORT_SUBSTITUTION,
  IMPORT_SUBSTITUTION_EVIDENCE,
  RCA,
  TRADE_OPPORTUNITIES,
  INVESTMENT_OPPORTUNITIES,
  type Opportunity,
} from "@/lib/intelligence/centre-data";
import { useDecisions } from "@/components/decisions/decision-store";
import { DecisionCard } from "@/components/decisions/decision-card";

/**
 * Intelligence Centre (UI Evolution spec, Priority 6): the ten analytical
 * capabilities behind the Decision Centre, each rendered from evidence-backed
 * data. Demo throughout — these become model outputs in v2 Phase 5; the point
 * here is that every module already answers "what should I do next?".
 */

const MODULES = [
  { id: "warnings", label: "Early Warning Centre", icon: "M12 3 2 20h20zM12 10v4M12 17h.01" },
  { id: "anomalies", label: "Anomaly Detection", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { id: "forecast", label: "Forecasting", icon: "M4 4v16h16M8 14l3-3 2 2 5-6" },
  { id: "rca", label: "Root Cause Analysis", icon: "M12 3v6M12 9l-6 6M12 9l6 6M6 15v6M18 15v6" },
  { id: "recommendations", label: "Recommendation Engine", icon: "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" },
  { id: "trade-opps", label: "Trade Opportunities", icon: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4M8 17h6a3 3 0 0 0 3-3V9" },
  { id: "invest-opps", label: "Investment Opportunities", icon: "M4 20V6M4 20h16M8 20v-6M12 20v-9M16 20v-4M20 20V9" },
  { id: "substitution", label: "Import Substitution", icon: "M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4" },
  { id: "benchmarking", label: "Benchmarking", icon: "M8 21V9M12 21V3M16 21v-7M4 21h16" },
  { id: "briefings", label: "Executive Briefings", icon: "M6 3h9l3 3v15H6zM15 3v3h3M8 12h8M8 16h8" },
] as const;

type ModuleId = (typeof MODULES)[number]["id"];

const SEV_TONE: Record<string, string> = { severe: "var(--destructive)", high: "var(--warning)", moderate: "var(--info)" };

function ExplainButton({ evidence, label = "Explain" }: { evidence: EvidenceRecord; label?: string }) {
  const open = useEvidence();
  return (
    <button onClick={() => open(evidence)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-primary hover:bg-muted">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>
      {label}
    </button>
  );
}

function Sparkline({ vals }: { vals: number[] }) {
  const w = 120, h = 26, mx = Math.max(...vals), mn = Math.min(...vals);
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - mn) / (mx - mn || 1)) * (h - 4)).toFixed(1)}`);
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts.join(" ")} fill="none" stroke="var(--brand-blue)" strokeWidth="1.6" />
    </svg>
  );
}

function OpportunityList({ items }: { items: Opportunity[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((o, i) => (
        <div key={o.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-navy font-mono text-[11px] font-bold text-white">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-[13.5px] font-semibold text-card-foreground">{o.title}</h3>
              <span className="font-mono text-[10px] text-muted-foreground">{o.object}</span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">{o.rationale}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="font-heading text-[17px] font-extrabold tabular-nums text-foreground">{o.value}</span>
            <ExplainButton evidence={o.evidence} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function IntelligenceView() {
  const [moduleId, setModuleId] = useState<ModuleId>("warnings");
  const { decisions } = useDecisions();

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-border bg-card p-2 lg:sticky lg:top-0">
        <p className="px-2 pb-1.5 pt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">Capabilities</p>
        <div className="flex flex-col gap-0.5">
          {MODULES.map((m) => (
            <button
              key={m.id}
              onClick={() => setModuleId(m.id)}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors ${
                m.id === moduleId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg>
              {m.label}
            </button>
          ))}
        </div>
      </aside>

      <div className="min-w-0">
        {moduleId === "warnings" && (
          <div className="flex flex-col gap-2.5">
            {EARLY_WARNINGS.map((w) => (
              <div key={w.signal} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEV_TONE[w.severity] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-card-foreground">{w.signal}</p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                    {w.href ? <Link href={w.href} className="text-primary hover:underline">{w.object}</Link> : w.object} · {w.severity}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">→ {w.action}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {w.decisionId && (
                    <Link href={`/decision/${w.decisionId}`} className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90">
                      Open decision
                    </Link>
                  )}
                  <ExplainButton evidence={w.evidence} />
                </div>
              </div>
            ))}
          </div>
        )}

        {moduleId === "anomalies" && (
          <div className="flex flex-col gap-2.5">
            {ANOMALIES.map((a) => (
              <div key={a.metric + a.object} className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-card-foreground">{a.metric}</p>
                  <p className="font-mono text-[10.5px] text-muted-foreground">{a.object} · {a.window}</p>
                  <p className="mt-1 font-mono text-[12px] font-semibold text-warning">{a.deviation}</p>
                </div>
                <Sparkline vals={a.spark} />
                <ExplainButton evidence={a.evidence} />
              </div>
            ))}
            <p className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-[12px] text-muted-foreground">
              Rolling z-score detection over the Gold activity marts. Model-based detection (isolation forests over AIS tracks) arrives with v2 Phase 5.
            </p>
          </div>
        )}

        {moduleId === "forecast" && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-bold text-foreground">Port calls — Durban, weekly actual vs 4-week projection</h3>
                <p className="text-[11.5px] text-muted-foreground">Seasonal-naive model over gold_port_activity_30d · ±1σ band W31: 104–132</p>
              </div>
              <ExplainButton evidence={FORECAST_EVIDENCE} />
            </div>
            <TrendLines
              data={FORECAST_SERIES}
              xKey="week"
              series={[
                { key: "actual", label: "Actual" },
                { key: "forecast", label: "Forecast" },
              ]}
              height={300}
            />
            <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">demo · model output, not a measurement — forecast marts land in v2 Phase 5</p>
          </div>
        )}

        {moduleId === "rca" && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-[14px] font-bold text-foreground">{RCA.question}</h3>
              <ExplainButton evidence={RCA.evidence} />
            </div>
            <div className="flex flex-col gap-2">
              {RCA.nodes.map((n) => (
                <div key={n.factor} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-semibold text-card-foreground">{n.factor}</p>
                    <span className="font-mono text-[12px] font-bold tabular-nums text-foreground">{n.contribution}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-[var(--brand-blue)]" style={{ width: `${n.contribution}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">{n.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-lg border p-3 text-[12.5px] text-foreground" style={{ borderColor: "color-mix(in srgb,var(--accent) 30%,transparent)", background: "color-mix(in srgb,var(--accent) 8%,var(--card))" }}>
              <b className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-accent">Conclusion · </b>
              {RCA.conclusion}
            </p>
          </div>
        )}

        {moduleId === "recommendations" && (
          <>
            <p className="mb-3 text-[12.5px] text-muted-foreground">
              Active recommendations, rendered as decision work items — accept, delegate or simulate them right here.
            </p>
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]">
              {decisions.filter((d) => d.state === "open").map((d) => (
                <DecisionCard key={d.id} decision={d} />
              ))}
            </div>
          </>
        )}

        {moduleId === "trade-opps" && <OpportunityList items={TRADE_OPPORTUNITIES} />}
        {moduleId === "invest-opps" && <OpportunityList items={INVESTMENT_OPPORTUNITIES} />}

        {moduleId === "substitution" && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-bold text-foreground">Import Substitution Index — where AfCFTA production can replace extra-African imports</h3>
                <p className="text-[11.5px] text-muted-foreground">Extra-African import value × regional production feasibility</p>
              </div>
              <ExplainButton evidence={IMPORT_SUBSTITUTION_EVIDENCE} />
            </div>
            <div className="flex flex-col gap-2">
              {IMPORT_SUBSTITUTION.map((r) => (
                <div key={r.commodity} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-semibold text-card-foreground">{r.commodity}</p>
                    <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{r.value}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${r.index}%` }} />
                    </div>
                    <span className="font-mono text-[11px] font-bold tabular-nums text-foreground">{r.index}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {moduleId === "benchmarking" && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-bold text-foreground">Port Competitiveness Score — pilot peer set</h3>
                <p className="text-[11.5px] text-muted-foreground">Weighted throughput, wait time, connectivity &amp; cost · demo composite</p>
              </div>
              <ExplainButton evidence={BENCHMARK_EVIDENCE} />
            </div>
            <RankedBars data={BENCHMARK_PORTS} nameKey="port" valueKey="score" valueLabel="Score /100" height={300} />
          </div>
        )}

        {moduleId === "briefings" && (
          <div className="flex flex-col gap-3">
            {BRIEFINGS.map((b) => (
              <article key={b.title} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-baseline gap-2.5">
                  <h3 className="text-[14px] font-bold text-foreground">{b.title}</h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{b.audience} · {b.date}</span>
                </div>
                <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
                  {b.bullets.map((line) => (
                    <li key={line} className="text-[12.5px] leading-relaxed text-muted-foreground">{line}</li>
                  ))}
                </ul>
              </article>
            ))}
            <p className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-[12px] text-muted-foreground">
              Generated briefings are grounded in the same Gold marts as the dashboards — ask an AI Advisor to expand any line.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

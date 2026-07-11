"use client";

import { useState } from "react";
import { useEvidence } from "@/components/evidence/evidence-drawer";
import { useDecisions } from "@/components/decisions/decision-store";
import { DecisionCard } from "@/components/decisions/decision-card";
import type { EvidenceRecord } from "@/lib/evidence/types";

/**
 * Decision Centre view (Design Bible §5, UI Evolution spec Priority 1).
 * Decision-first: recommendations lead as operational work items, ranked by
 * value at stake; supporting Gold intelligence sits below. Every card and tile
 * opens the evidence drawer — the decision, then the evidence.
 */
export interface Tile {
  name: string;
  value: string;
  unit?: string;
  delta: string;
  deltaDir: "up" | "down" | "flat";
  spark: number[];
  status: "live" | "demo" | "planned";
  evidence: EvidenceRecord;
}

const STATUS_TEXT: Record<string, string> = { live: "text-success", demo: "text-warning", planned: "text-muted-foreground" };
const STATUS_VAR: Record<string, string> = { live: "var(--success)", demo: "var(--warning)", planned: "var(--muted-foreground)" };

function Sparkline({ vals, up }: { vals: number[]; up: boolean }) {
  const w = 190, h = 34, mx = Math.max(...vals), mn = Math.min(...vals);
  const col = up ? "var(--chart-5)" : "var(--chart-3)";
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-2.5">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={col} opacity="0.12" />
      <path d={d} fill="none" stroke={col} strokeWidth="1.8" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.4" fill={col} />
    </svg>
  );
}

const STAKEHOLDER_FILTERS = ["All", "Port Authority", "Government & Policy", "DFI Investment", "AfCFTA Monitoring"];

export function DecisionCentreView({ tiles }: { tiles: Tile[] }) {
  const open = useEvidence();
  const { decisions } = useDecisions();
  const [filter, setFilter] = useState("All");

  const sevRank = { hi: 0, md: 1, gd: 2 } as const;
  const visible = decisions
    .filter((d) => filter === "All" || d.stakeholder === filter)
    .sort((a, b) => (a.state === "open" ? 0 : 1) - (b.state === "open" ? 0 : 1) || sevRank[a.sev] - sevRank[b.sev]);
  const openCount = decisions.filter((d) => d.state === "open").length;

  return (
    <>
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Command Centre · Port CEO</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold text-foreground">What needs your decision today</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
          Signals that crossed a threshold, turned into operational work items. Accept, modify, delegate or simulate each
          recommendation — the evidence, lineage and confidence behind it are one click away on every card.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-[15px] font-bold text-foreground">Decisions</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {openCount} awaiting · ranked by urgency &amp; value at stake
        </span>
        <span className="ml-auto flex flex-wrap gap-1.5">
          {STAKEHOLDER_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                filter === f ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </span>
      </div>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]">
        {visible.map((d) => (
          <DecisionCard key={d.id} decision={d} />
        ))}
      </div>

      <div className="mb-3 mt-8 flex items-baseline gap-2.5">
        <h2 className="text-[15px] font-bold text-foreground">Supporting intelligence</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Gold outputs · Port of Durban</span>
      </div>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(228px,1fr))]">
        {tiles.map((t) => (
          <button key={t.name} onClick={() => open(t.evidence)} className="flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[12.5px] font-medium text-muted-foreground">{t.name}</span>
              <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${STATUS_TEXT[t.status]}`} style={{ background: `color-mix(in srgb, ${STATUS_VAR[t.status]} 15%, transparent)` }}>{t.status}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1 font-heading text-3xl font-extrabold tabular-nums text-card-foreground">
              {t.value}{t.unit && <small className="text-sm font-semibold text-muted-foreground">{t.unit}</small>}
            </div>
            <div className={`mt-0.5 font-mono text-[11.5px] ${t.deltaDir === "down" ? "text-destructive" : t.deltaDir === "up" ? "text-success" : "text-muted-foreground"}`}>{t.delta}</div>
            <Sparkline vals={t.spark} up={t.deltaDir !== "down"} />
            <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
              <span className="font-mono text-[10px] tracking-[0.04em] text-muted-foreground">gold · ontology-keyed</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                Explain <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-7 rounded-xl border border-dashed border-border bg-card px-4 py-3.5 text-[12px] text-muted-foreground">
        <b className="text-foreground">Decision OS.</b> Decisions are operational work items: actions move them through the
        Insight → Recommendation → Approval → Workflow → Execution → Monitoring → Outcome lifecycle (see the Workflow Centre).
        Cards are illustrative where a Gold score mart doesn’t exist yet; port calls &amp; throughput use real PortWatch data when
        the pipeline is running (else demo). Every value opens its Bronze→Silver→Gold lineage.
      </p>
    </>
  );
}

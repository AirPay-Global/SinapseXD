"use client";

import { useEvidence } from "@/components/evidence/evidence-drawer";
import type { EvidenceRecord } from "@/lib/evidence/types";

/**
 * Decision Centre view (Design Bible §5). Decision-first: recommendations lead,
 * ranked by value at stake; supporting Gold intelligence sits below. Every card
 * and tile opens the evidence drawer — the decision, then the evidence.
 */

export interface Deck {
  sev: "hi" | "md" | "gd";
  objectRef: string;
  title: string;
  body: string;
  recommendation: string;
  impactLabel: string;
  impactValue: string;
  evidence: EvidenceRecord;
}
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

const SEV: Record<Deck["sev"], string> = { hi: "bg-destructive", md: "bg-accent", gd: "bg-success" };
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

export function DecisionCentreView({ decks, tiles }: { decks: Deck[]; tiles: Tile[] }) {
  const open = useEvidence();
  return (
    <>
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Command Centre · Port CEO</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold text-foreground">What needs your decision today</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
          Signals that crossed a threshold in the last 24 hours. Sinapse surfaces the decision first — the evidence, lineage and
          confidence behind it are one click away on every card.
        </p>
      </div>

      <div className="mb-3 flex items-baseline gap-2.5">
        <h2 className="text-[15px] font-bold text-foreground">Decisions</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">ranked by value at stake</span>
      </div>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(330px,1fr))]">
        {decks.map((d) => (
          <article key={d.title} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex gap-3 px-4 pb-3 pt-4">
              <div className={`w-[3px] shrink-0 rounded ${SEV[d.sev]}`} />
              <div className="min-w-0">
                <div className="font-mono text-[10.5px] tracking-[0.03em] text-muted-foreground">{d.objectRef}</div>
                <h3 className="mt-0.5 text-[15px] font-semibold leading-snug text-card-foreground">{d.title}</h3>
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">{d.body}</p>
              </div>
            </div>
            <div className="mx-4 mb-3 rounded-lg border p-3" style={{ borderColor: "color-mix(in srgb,var(--accent) 34%,transparent)", background: "color-mix(in srgb,var(--accent) 10%,var(--card))" }}>
              <p className="mb-1 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" /></svg>
                Recommended action
              </p>
              <p className="text-[13px] font-medium text-foreground">{d.recommendation}</p>
            </div>
            <div className="mt-auto flex items-center gap-3 border-t border-border px-4 py-3">
              <span className="text-[12px] text-muted-foreground">
                {d.impactLabel} <b className="tabular-nums text-foreground">{d.impactValue}</b>
              </span>
              <button onClick={() => open(d.evidence)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-muted">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>
                Evidence
              </button>
            </div>
          </article>
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
        <b className="text-foreground">Phase A.</b> The Decision Centre shell and evidence drawer are live. Decision cards and the
        score tiles are illustrative where a Gold score mart doesn’t exist yet; port calls &amp; throughput use real PortWatch data
        when the pipeline is running (else demo). Every value opens its Bronze→Silver→Gold lineage.
      </p>
    </>
  );
}

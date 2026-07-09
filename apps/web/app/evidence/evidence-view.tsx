"use client";

import { Explainable } from "@/components/evidence/explainable";
import { quickEvidence } from "@/lib/evidence/build";

const SAMPLES = [
  quickEvidence({
    metric: "Berth Utilisation Index",
    value: "78%",
    objectRef: "object · port:durban",
    confidence: 0.86,
    status: "live",
    pillar: "AIS & Vessels",
    source: "portwatch",
    gold: "gold_port_berth_utilisation",
    recommendation: "Utilisation trending above the 70% congestion-risk threshold — flag to Port Ops.",
  }),
  quickEvidence({
    metric: "Corridor Performance Index",
    value: "62 / 100",
    objectRef: "object · corridor:durban-lusaka",
    confidence: 0.35,
    status: "demo",
    pillar: "Trade Analytics",
    source: "un-comtrade",
    gold: "gold_corridor_performance (planned)",
  }),
  quickEvidence({
    metric: "SDG 10 — Trade Cost Reduction",
    value: "-4.1% YoY",
    objectRef: "object · country:zaf",
    confidence: 0.2,
    status: "planned",
    pillar: "SDG Reporting",
    source: "un-sdg-api",
    gold: "gold_sdg_indicators (planned)",
  }),
];

export function EvidenceCentreView() {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-heading text-[15px] font-semibold text-foreground">How evidence works</p>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          Every KPI in Sinapse XD can carry a lineage from raw source to decision. <span className="font-medium text-foreground">Bronze</span> is
          the immutable, checksummed landing zone for each pillar feed. <span className="font-medium text-foreground">Silver</span> normalises and
          resolves records to canonical ontology keys. <span className="font-medium text-foreground">Gold</span> is the pre-aggregated mart a
          dashboard actually reads. Every value is tagged <span className="font-mono text-[11px]">live</span>,{" "}
          <span className="font-mono text-[11px]">demo</span>, or <span className="font-mono text-[11px]">planned</span> — we never present a
          placeholder as real data.
        </p>
      </div>

      <div>
        <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Sample evidence trails</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SAMPLES.map((ev) => (
            <div key={ev.metric} className="rounded-xl border border-border bg-card p-5">
              <p className="text-[13px] font-medium text-muted-foreground">{ev.metric}</p>
              <p className="mt-1 font-heading text-2xl font-bold text-foreground">{ev.value}</p>
              <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">{ev.objectRef}</p>
              <div className="mt-3">
                <Explainable evidence={ev} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

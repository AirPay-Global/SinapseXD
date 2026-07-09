"use client";

import Link from "next/link";
import { useEvidence } from "@/components/evidence/evidence-drawer";
import type { EvidenceRecord } from "@/lib/evidence/types";

export interface Relationship { kind: string; label: string; href?: string }
export interface Metric { name: string; value: string; tone?: "ok" | "warn" | "plain"; evidence: EvidenceRecord }
export interface ProfileData {
  name: string;
  id: string;
  meta: string[];
  status: "live" | "demo" | "planned";
  confidence: number;
  relationships: Relationship[];
  metrics: Metric[];
  timeline: Array<{ time: string; text: string }>;
  aiSummary: string;
}

function Ring({ v }: { v: number }) {
  const r = 15.5, c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 42 42">
      <circle cx="21" cy="21" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle cx="21" cy="21" r={r} fill="none" stroke="var(--success)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform="rotate(-90 21 21)" />
      <text x="21" y="21" textAnchor="middle" dominantBaseline="central" className="font-mono" fontSize="10" fontWeight="700" fill="var(--foreground)">{Math.round(v * 100)}</text>
    </svg>
  );
}

const TONE: Record<string, string> = { ok: "text-success", warn: "text-warning", plain: "text-card-foreground" };

export function ProfileView({ data }: { data: ProfileData }) {
  const open = useEvidence();
  return (
    <>
      <Link href="/ontology" className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-muted">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Ontology Explorer
      </Link>

      <header className="mb-5 flex items-start gap-4 rounded-xl border border-border bg-card p-5">
        <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand-blue to-brand-navy text-white">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#fff" strokeWidth="1.7"><path d="M3 21h18M5 21V10l7-4 7 4v11M9 21v-5h6v5M12 6V3" /></svg>
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Ontology object · Port</p>
          <h1 className="font-heading text-[23px] font-bold text-foreground">{data.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {data.meta.map((m) => (
              <span key={m} className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{m}</span>
            ))}
            <span className="rounded-full px-2 py-0.5 font-mono text-[10px] text-success" style={{ background: "color-mix(in srgb,var(--success) 15%,transparent)" }}>{data.status} · PortWatch</span>
          </div>
        </div>
        <div className="ml-auto shrink-0 text-center">
          <Ring v={data.confidence} />
          <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">Data confidence</div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Relationships</p>
            <div className="flex flex-wrap gap-2">
              {data.relationships.map((r) => {
                const chip = (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] text-card-foreground">
                    <span className="font-mono text-[9.5px] text-muted-foreground">{r.kind}</span>
                    <b className="font-semibold">{r.label}</b>
                  </span>
                );
                return r.href ? <Link key={r.kind} href={r.href} className="hover:opacity-80">{chip}</Link> : <span key={r.kind}>{chip}</span>;
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">AI summary</p>
            <p className="text-[13px] leading-relaxed text-foreground">{data.aiSummary}</p>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">Grounded in the ontology · every claim links to its Gold output. Full copilot arrives in Phase 5.</p>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Intelligence outputs — click to explain</p>
            <div className="flex flex-col">
              {data.metrics.map((m) => (
                <button key={m.name} onClick={() => open(m.evidence)} className="flex items-center justify-between border-b border-border py-2.5 text-left last:border-0 hover:bg-muted/40">
                  <span className="text-[12.5px] text-card-foreground">{m.name}</span>
                  <span className={`inline-flex items-center gap-2 font-mono text-[14px] font-semibold tabular-nums ${TONE[m.tone ?? "plain"]}`}>
                    {m.value}
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Timeline</p>
            <div className="relative pl-[18px]">
              <span className="absolute left-1 top-1 bottom-1 w-0.5 bg-border" />
              {data.timeline.map((t, i) => (
                <div key={i} className="relative pb-3.5 last:pb-0">
                  <span className="absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
                  <time className="font-mono text-[10.5px] text-muted-foreground">{t.time}</time>
                  <p className="mt-0.5 text-[12.5px] text-card-foreground">{t.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

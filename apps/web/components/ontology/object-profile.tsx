"use client";

import Link from "next/link";
import { useEvidence } from "@/components/evidence/evidence-drawer";
import { RelationshipGraph } from "@/components/ontology/relationship-graph";
import type { EvidenceRecord } from "@/lib/evidence/types";

/**
 * Generic Object Profile (Design Bible §7, UI Evolution spec Priority 3) —
 * reused across every ontology object type (Port, Country, Corridor, …) so
 * there is one profile standard, not a bespoke layout per type. Callers
 * supply the icon + type label; the shape of the page (header, health score,
 * relationship graph, AI summary, intelligence outputs, timeline, documents,
 * AI recommendations) never changes.
 */

export interface Relationship { kind: string; label: string; href?: string }
export interface Metric { name: string; value: string; tone?: "ok" | "warn" | "plain"; evidence: EvidenceRecord }
export interface ObjectDocument { name: string; kind: string; date: string }
export interface ObjectRecommendation { text: string; confidence: number }
export interface ProfileData {
  name: string;
  id: string;
  meta: string[];
  status: "live" | "demo" | "planned";
  /** Shown in the status pill, e.g. "PortWatch", "Ontology", "AIS". */
  sourceLabel: string;
  confidence: number;
  /** 0–100 composite object health; drives the header health chip. */
  healthScore?: number;
  relationships: Relationship[];
  metrics: Metric[];
  timeline: Array<{ time: string; text: string }>;
  aiSummary: string;
  documents?: ObjectDocument[];
  recommendations?: ObjectRecommendation[];
}

function Ring({ v }: { v: number }) {
  const r = 15.5, c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 42 42">
      <circle cx="21" cy="21" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      {/* Neutral blue, matching the Evidence drawer's confidence bar — confidence
          is not a status traffic light, so it shouldn't borrow success/warning hues. */}
      <circle cx="21" cy="21" r={r} fill="none" stroke="var(--brand-blue)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform="rotate(-90 21 21)" />
      <text x="21" y="21" textAnchor="middle" dominantBaseline="central" className="font-mono" fontSize="10" fontWeight="700" fill="var(--foreground)">{Math.round(v * 100)}</text>
    </svg>
  );
}

const TONE: Record<string, string> = { ok: "text-success", warn: "text-warning", plain: "text-card-foreground" };
const STATUS_TEXT: Record<string, string> = { live: "text-success", demo: "text-warning", planned: "text-muted-foreground" };
const STATUS_VAR: Record<string, string> = { live: "var(--success)", demo: "var(--warning)", planned: "var(--muted-foreground)" };

export function ObjectProfile({
  data,
  objectTypeLabel,
  iconPath,
}: {
  data: ProfileData;
  /** e.g. "Port", "Country", "Trade Corridor" — shown as "Ontology object · X". */
  objectTypeLabel: string;
  /** SVG path `d` for the header icon. */
  iconPath: string;
}) {
  const open = useEvidence();
  return (
    <>
      <Link href="/ontology" className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-muted">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Ontology Explorer
      </Link>

      <header className="mb-5 flex items-start gap-4 rounded-xl border border-border bg-card p-5">
        <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand-blue to-brand-navy text-white">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#fff" strokeWidth="1.7"><path d={iconPath} /></svg>
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Ontology object · {objectTypeLabel}</p>
          <h1 className="font-heading text-[23px] font-bold text-foreground">{data.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {data.meta.map((m) => (
              <span key={m} className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{m}</span>
            ))}
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${STATUS_TEXT[data.status]}`}
              style={{ background: `color-mix(in srgb, ${STATUS_VAR[data.status]} 15%, transparent)` }}
            >
              {data.status} · {data.sourceLabel}
            </span>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-start gap-4">
          {data.healthScore !== undefined && (
            <div className="text-center">
              <div
                className="grid h-[56px] w-[56px] place-items-center rounded-full border-4 font-heading text-[16px] font-extrabold tabular-nums"
                style={{
                  borderColor: `color-mix(in srgb, ${data.healthScore >= 70 ? "var(--success)" : data.healthScore >= 50 ? "var(--warning)" : "var(--destructive)"} 60%, transparent)`,
                  color: data.healthScore >= 70 ? "var(--success)" : data.healthScore >= 50 ? "var(--warning)" : "var(--destructive)",
                }}
              >
                {Math.round(data.healthScore)}
              </div>
              <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">Health score</div>
            </div>
          )}
          <div className="text-center">
            <Ring v={data.confidence} />
            <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">Data confidence</div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Relationship graph — click a node to navigate</p>
            {data.relationships.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No linked objects yet.</p>
            ) : (
              <RelationshipGraph center={data.name} relationships={data.relationships} />
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">AI summary</p>
            <p className="text-[13px] leading-relaxed text-foreground">{data.aiSummary}</p>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">Grounded in the ontology · every claim links to its Gold output. Ask an AI Advisor for depth.</p>
          </section>

          {data.recommendations && data.recommendations.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">AI recommendations</p>
              <div className="flex flex-col gap-2">
                {data.recommendations.map((r) => (
                  <div key={r.text} className="rounded-lg border p-2.5" style={{ borderColor: "color-mix(in srgb,var(--accent) 30%,transparent)", background: "color-mix(in srgb,var(--accent) 8%,var(--card))" }}>
                    <p className="text-[12.5px] text-foreground">{r.text}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">confidence {Math.round(r.confidence * 100)}%</p>
                  </div>
                ))}
              </div>
            </section>
          )}
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

          <section className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Documents</p>
            {data.documents && data.documents.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {data.documents.map((doc) => (
                  <div key={doc.name} className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l3 3v15H6zM15 3v3h3" /></svg>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-card-foreground">{doc.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{doc.kind} · {doc.date}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
                No documents attached yet — reports and exports will collect here.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

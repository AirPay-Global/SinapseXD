"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useEvidence } from "@/components/evidence/evidence-drawer";
import { PortSelector, type PortOption } from "@/components/port-selector";
import { GeoCanvas } from "@/components/satellite/geo-canvas";
import { OccupancyTimeline } from "@/components/satellite/occupancy-timeline";
import { BerthProvider, useBerths } from "@/components/satellite/berth-store";
import { factorRows } from "@/lib/satellite/detect";
import {
  BERTH_STATE_META, INTEL_SOURCE_LABEL, LAYERS, PROVENANCE_META,
  type Berth, type OccupancySlot, type Provenance, type SatelliteAnalysis, type VesselTrack,
} from "@/lib/satellite/types";

const PROV_CLASS: Record<string, string> = {
  observed: "bg-success/12 text-success",
  inferred: "bg-warning/15 text-warning",
  predicted: "bg-info/12 text-info",
  reviewed: "bg-info/12 text-info",
  verified: "bg-success/15 text-success",
  demo: "border border-border text-muted-foreground",
  planned: "border border-dashed border-border text-muted-foreground",
};
function ProvChip({ p }: { p: Provenance }) {
  const m = PROVENANCE_META[p];
  return <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${PROV_CLASS[m.tone]}`}>{m.label}</span>;
}

type Tab = "live" | "berths" | "occupancy" | "change" | "replay";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "live", label: "Live observation" },
  { id: "berths", label: "Berth discovery" },
  { id: "occupancy", label: "Occupancy" },
  { id: "change", label: "Change detection" },
  { id: "replay", label: "Historical replay" },
];

export function SatelliteView(props: { port: PortOption; ports: PortOption[]; seedBerths: Berth[]; tracks: VesselTrack[]; occupancy: OccupancySlot[] }) {
  return (
    <BerthProvider seed={props.seedBerths}>
      <Workspace {...props} />
    </BerthProvider>
  );
}

function Workspace({ port, ports, tracks, occupancy }: { port: PortOption; ports: PortOption[]; tracks: VesselTrack[]; occupancy: OccupancySlot[] }) {
  const { berths } = useBerths();
  const openEvidence = useEvidence();
  const [tab, setTab] = useState<Tab>("live");
  const [active, setActive] = useState<Set<string>>(() => new Set(LAYERS.filter((l) => l.defaultOn).map((l) => l.id)));
  const [selBerth, setSelBerth] = useState<string | undefined>();
  const [selVessel, setSelVessel] = useState<string | undefined>();

  const toggle = (id: string) => setActive((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const berth = berths.find((b) => b.id === selBerth);
  const vessel = tracks.find((v) => v.mmsi === selVessel);
  const candidates = berths.filter((b) => b.state === "candidate" || b.state === "machine_inferred");
  const verified = berths.filter((b) => b.state === "port_verified" || b.state === "published");
  const satShare = Math.round((tracks.filter((t) => t.source === "satellite").length / tracks.length) * 100);
  const avgConf = Math.round((berths.reduce((s, b) => s + b.confidence, 0) / berths.length) * 100);

  const grouped = useMemo(() => {
    const g: Record<string, typeof LAYERS> = {};
    for (const l of LAYERS) (g[l.group] ??= []).push(l);
    return g;
  }, []);
  const GROUP_LABEL: Record<string, string> = { ais: "AIS", imagery: "Imagery", geometry: "Port geometry", environment: "Environment", confidence: "Confidence" };

  return (
    <div className="flex flex-col gap-3">
      {/* Top context bar (spec §5) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-card px-4 py-2.5">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Satellite Intelligence</p>
          <p className="text-[14px] font-bold text-foreground">Observe vessels, berths, ports & infrastructure</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <Ctx k="AIS freshness" v="live · &lt;30 min" tone="ok" />
          <Ctx k="Imagery" v="planned" tone="muted" />
          <Ctx k="Active layers" v={String(active.size)} />
          <Ctx k="Avg berth confidence" v={`${avgConf}%`} />
          <Ctx k="Data status" v="AIS-only · demo" tone="warn" />
        </div>
        <PortSelector ports={ports} selectedId={port.id} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[210px_1fr_310px]">
        {/* Left — layers & filters */}
        <aside className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">Layers & filters</p>
          <div className="space-y-3">
            {Object.entries(grouped).map(([group, ls]) => (
              <div key={group}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{GROUP_LABEL[group]}</p>
                <div className="space-y-0.5">
                  {ls.map((l) => (
                    <label key={l.id} className={`flex items-center gap-2 rounded px-1.5 py-1 text-[12px] ${l.provenance === "planned" ? "opacity-60" : "cursor-pointer hover:bg-muted"}`}>
                      <input type="checkbox" checked={active.has(l.id)} disabled={l.provenance === "planned"} onChange={() => toggle(l.id)} className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
                      <span className="flex-1 text-foreground">{l.label}</span>
                      {l.provenance === "planned" && <span className="font-mono text-[8.5px] uppercase text-muted-foreground">soon</span>}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Centre — geospatial canvas + tabs */}
        <section className="min-w-0 rounded-xl border border-border bg-card p-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {(tab === "live" || tab === "berths" || tab === "replay") && (
            <>
              <GeoCanvas berths={berths} tracks={tracks} active={active} selectedBerth={selBerth} selectedVessel={selVessel}
                onSelectBerth={(id) => { setSelBerth(id); setSelVessel(undefined); }}
                onSelectVessel={(m) => { setSelVessel(m); setSelBerth(undefined); }} />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                <Legend c="var(--chart-1)" label="Terrestrial AIS track" />
                <Legend c="var(--chart-7)" label="Satellite AIS track" dashed />
                <Legend c="var(--success)" label="Port-verified berth" />
                <Legend c="var(--warning)" label="Candidate berth" dashed />
                <span className="ml-auto">Satellite AIS share: {satShare}%</span>
              </div>
              {tab === "replay" && (
                <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
                  Historical replay scrubs the last 14 days of tracks, arrivals and departures. The full playback engine (variable speed, per-berth filtering) lands with the Silver track pipeline — the occupancy tab already shows the same window as a timeline.
                </p>
              )}
            </>
          )}

          {tab === "occupancy" && <OccupancyTimeline slots={occupancy} />}

          {tab === "change" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {["Acquisition A — planned", "Acquisition B — planned"].map((t) => (
                <div key={t} className="flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-center">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 15l5-4 4 3 5-5 4 4" /></svg>
                  <p className="mt-2 text-[11px] text-muted-foreground">{t}</p>
                </div>
              ))}
              <p className="sm:col-span-2 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
                Before/after change detection (quay extension, dredging, reclamation, storm damage) needs optical &amp; radar imagery — a Phase-2 data product. Detections will require confidence and validation status before being linked to Port, Terminal or Project objects (spec §4.5, §14).
              </p>
            </div>
          )}

          {/* Selected object detail */}
          {tab !== "occupancy" && tab !== "change" && (berth || vessel) && (
            <div className="mt-3 rounded-lg border border-border bg-background p-3">
              {berth && <BerthDetail berth={berth} onEvidence={() => openEvidence(berth.evidence)} />}
              {vessel && <VesselDetail v={vessel} />}
            </div>
          )}
        </section>

        {/* Right — AI advisor */}
        <aside className="rounded-xl border border-border bg-card p-3">
          <AdvisorPanel port={port} berths={berths} tracks={tracks} active={active} candidates={candidates.length} verified={verified.length} />
        </aside>
      </div>

      {/* Handoffs (spec §10, §13) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-2.5 text-[12px]">
        <span className="text-muted-foreground">Take this view further:</span>
        <Link href={`/dataviz?from=satellite&port=${port.id}`} className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground hover:bg-muted">Open in Data Visualisation Centre →</Link>
        <Link href={`/reports?from=satellite&port=${port.id}`} className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground hover:bg-muted">Add to Reporting Centre →</Link>
        <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">carries {port.name} · active layers · 14-day window</span>
      </div>
    </div>
  );
}

function Ctx({ k, v, tone }: { k: string; v: string; tone?: "ok" | "warn" | "muted" }) {
  const c = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <span className="flex flex-col leading-tight">
      <span className="font-mono text-[8.5px] uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className={`font-semibold ${c}`} dangerouslySetInnerHTML={{ __html: v }} />
    </span>
  );
}
function Legend({ c, label, dashed }: { c: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <svg width="14" height="6"><line x1="0" y1="3" x2="14" y2="3" stroke={c} strokeWidth="2" strokeDasharray={dashed ? "3 2" : undefined} /></svg>
      {label}
    </span>
  );
}

function BerthDetail({ berth, onEvidence }: { berth: Berth; onEvidence: () => void }) {
  const { review, verify, reject, audit } = useBerths();
  const meta = BERTH_STATE_META[berth.state];
  const rows = factorRows(berth.factors);
  const trail = audit(berth.id);
  const isCandidate = berth.state === "candidate" || berth.state === "machine_inferred";
  const reviewed = berth.state === "analyst_reviewed";
  const terminal = berth.state === "port_verified" || berth.state === "published" || berth.state === "rejected";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-bold text-foreground">{berth.name}</h3>
        <span className={`rounded-full bg-muted px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wide ${meta.tone}`}>{meta.label}</span>
        <ProvChip p={meta.provenance} />
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">{INTEL_SOURCE_LABEL[berth.source]}</span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">confidence {Math.round(berth.confidence * 100)}%</span>
      </div>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        {berth.terminal} · {berth.lengthM} m · est. depth {berth.estDepthM} m · {berth.commodity} · {berth.occupied ? `occupied by ${berth.currentVessel}` : "available"} · util {berth.utilisationPct}%
      </p>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{r.label}</span>
            <span className={`font-medium tabular-nums ${r.strong ? "text-foreground" : "text-warning"}`}>{r.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isCandidate && <button onClick={() => review(berth.id)} className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground">Mark analyst-reviewed</button>}
        {reviewed && <button onClick={() => verify(berth.id)} className="rounded-lg bg-success px-3 py-1.5 text-[12px] font-semibold text-white">Confirm as port-verified</button>}
        {!terminal && <button onClick={() => reject(berth.id)} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-destructive hover:bg-muted">Reject</button>}
        <button onClick={onEvidence} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-muted">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>
          Evidence
        </button>
      </div>
      {isCandidate && (
        <p className="mt-2 text-[10.5px] text-muted-foreground">
          A candidate cannot be confirmed directly — it must be analyst-reviewed first (spec §14). Actions are recorded to the session audit trail.
        </p>
      )}
      {trail.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Audit trail</p>
          <ul className="mt-1 space-y-0.5">
            {trail.slice().reverse().map((a, i) => (
              <li key={i} className="text-[10.5px] text-muted-foreground"><span className="tabular-nums">{new Date(a.at).toLocaleTimeString()}</span> · {a.actor} · {a.action}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VesselDetail({ v }: { v: VesselTrack }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-bold text-foreground">{v.name}</h3>
        <ProvChip p="observed" />
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">{v.source === "satellite" ? "Satellite AIS" : "Terrestrial AIS"}</span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">signal {Math.round(v.signalConfidence * 100)}%</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3 text-[11px]">
        {[
          ["MMSI", v.mmsi], ["Class", v.vesselClass], ["Speed", `${v.speedKn} kn`],
          ["Heading", `${v.headingDeg}°`], ["Nav status", v.navStatus], ["Destination", v.destination],
          ["ETA", v.eta], ["Last signal", v.lastSignal],
        ].map(([k, val]) => (
          <div key={k} className="flex items-center justify-between">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium text-foreground">{val}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground">Directly observed AIS. Route, likely destination and likely berth are model inferences — open the Advisor to interpret.</p>
    </div>
  );
}

function AdvisorPanel({ port, berths, tracks, active, candidates, verified }: { port: PortOption; berths: Berth[]; tracks: VesselTrack[]; active: Set<string>; candidates: number; verified: number }) {
  const [analysis, setAnalysis] = useState<SatelliteAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const context = `Port: ${port.name} (${port.country}). Berths on screen: ${berths.length} (${verified} port-verified, ${candidates} candidate/inferred). Vessel tracks: ${tracks.length}, of which ${tracks.filter((t) => t.source === "satellite").length} from satellite AIS. Active layers: ${[...active].join(", ")}. No optical/radar imagery available (planned). All berths are demo/AIS-inferred, none port-confirmed in this environment.`;

  async function analyse(question?: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/satellite/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context, question }) });
      const data = await res.json();
      setAnalysis(data.analysis ?? null);
    } catch {
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-blue" fill="currentColor"><path d="M12 2l1.8 5.6L19.5 9l-5.7 1.4L12 16l-1.8-5.6L4.5 9l5.7-1.4z" /></svg>
        <p className="text-[13px] font-semibold text-foreground">Satellite Advisor</p>
      </div>
      <button onClick={() => analyse()} disabled={loading} className="w-full rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-40">
        {loading ? "Analysing…" : "Analyse current view"}
      </button>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Are any candidate berths ready to confirm?", "What are the data limitations here?", "Which vessel is most likely to berth next?"].map((q) => (
          <button key={q} onClick={() => analyse(q)} disabled={loading} className="rounded-full border border-border px-2 py-1 text-left text-[10.5px] text-muted-foreground hover:bg-muted disabled:opacity-40">{q}</button>
        ))}
      </div>

      {analysis ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {!analysis.live && <p className="rounded bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">Advisor not connected (no API key) — showing the structured template.</p>}
          <Section title="What is visible" body={analysis.visible} tone="observed" />
          <Section title="What the system inferred" body={analysis.inferred} tone="inferred" />
          {analysis.changed && <Section title="What changed" body={analysis.changed} tone="neutral" />}
          <Section title="Why it may matter" body={analysis.matters} tone="neutral" />
          <Section title="Alternative explanations" body={analysis.alternatives} tone="neutral" />
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Data limitations</p>
            <ul className="mt-0.5 list-disc pl-4 text-[11px] text-muted-foreground">{analysis.limitations?.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Confidence</span>
            <span className={`font-semibold ${analysis.confidence === "High" ? "text-success" : analysis.confidence === "Medium" ? "text-warning" : "text-muted-foreground"}`}>{analysis.confidence}</span>
          </div>
          <div className="rounded-lg border border-accent/30 bg-accent/5 px-2.5 py-2">
            <p className="font-mono text-[9px] uppercase tracking-wide text-accent">Recommended next step</p>
            <p className="mt-0.5 text-[11.5px] text-foreground">{analysis.nextStep}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
          The Advisor separates what was <b className="text-foreground">observed</b> from what a model <b className="text-foreground">inferred</b> or <b className="text-foreground">predicted</b>, always with limitations and a next step (spec §6).
        </p>
      )}
    </div>
  );
}

function Section({ title, body, tone }: { title: string; body: string; tone: "observed" | "inferred" | "neutral" }) {
  const dot = tone === "observed" ? "bg-success" : tone === "inferred" ? "bg-warning" : "bg-muted-foreground";
  return (
    <div>
      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{title}
      </p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-foreground">{body}</p>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@/components/dataviz/canvas";
import { useDecisions } from "@/components/decisions/decision-store";
import { useEvidence } from "@/components/evidence/evidence-drawer";
import { useRole } from "@/components/role-context";
import { CATEGORIES, GEOS, LAYERS, getLayer, layerEvidence, type Layer } from "@/lib/dataviz/catalogue";
import { assess, COMPAT_LABEL, COMPAT_VAR } from "@/lib/dataviz/compat";
import { localCommentary, pearson } from "@/lib/dataviz/analysis";
import { QUESTIONS, TEMPLATES } from "@/lib/dataviz/templates";
import { VIZ_META, VIZ_TYPES, type VizType } from "@/lib/dataviz/viz";

/**
 * Data Visualisation Centre (spec §4, §14, §16, §19, §24). A four-part
 * exploratory workspace: layers on the left, the visual canvas in the centre,
 * the AI Advisor on the right, context + evidence up top. Overlaying layers
 * builds a perspective history; the AI Advisor reads the exact canvas state and
 * separates observation from interpretation under the §15 guardrails; and any
 * view can become a decision, a report input or a simulation.
 */

interface Perspective {
  label: string;
  layers: string[];
  viz: VizType;
}
interface SavedView {
  id: string;
  title: string;
  layers: string[];
  viz: VizType;
  at: string;
}

const SAVED_KEY = "sinapse.dataviz.saved";

function useSaved(): [SavedView[], (v: SavedView) => void] {
  const [saved, setSaved] = useState<SavedView[]>([]);
  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"));
    } catch {
      /* ignore */
    }
  }, []);
  const add = (v: SavedView) =>
    setSaved((prev) => {
      const next = [v, ...prev].slice(0, 20);
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return [saved, add];
}

export function DataVizView() {
  const [view, setView] = useState<{ layers: string[]; viz: VizType } | null>(null);
  const [saved, addSaved] = useSaved();

  if (!view) return <Home onStart={(layers, viz) => setView({ layers, viz })} saved={saved} />;
  return <Workspace initial={view} onHome={() => setView(null)} onSave={addSaved} saved={saved} />;
}

// ── Home (§24) ──────────────────────────────────────────
function Home({ onStart, saved }: { onStart: (layers: string[], viz: VizType) => void; saved: SavedView[] }) {
  const groups = [...new Set(TEMPLATES.map((t) => t.group))];
  const alerts = LAYERS.filter((l) => l.status !== "live").slice(0, 4);
  return (
    <>
      <div className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Data Visualisation Centre</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold text-foreground">Combine data. Reveal patterns. See the system differently.</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
          Overlay trusted datasets to surface relationships a single chart can&apos;t show — then let the AI Advisor explain what the
          combined data appears to show, and turn any perspective into a decision, report or simulation.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <button onClick={() => onStart([], "map")} className="rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-foreground hover:border-border-strong">Start blank</button>
        {QUESTIONS.slice(0, 3).map((q) => {
          const t = TEMPLATES.find((x) => x.id === q.templateId)!;
          return (
            <button key={q.q} onClick={() => onStart(t.layers, t.viz)} className="rounded-lg border border-border bg-card px-3.5 py-2 text-left text-[12.5px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
              <span className="font-mono text-[9px] uppercase tracking-wide text-primary">Ask</span> {q.q}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <h2 className="mb-2.5 text-[15px] font-bold text-foreground">Templates</h2>
          {groups.map((g) => (
            <div key={g} className="mb-4">
              <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">{g}</p>
              <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                {TEMPLATES.filter((t) => t.group === g).map((t) => (
                  <button key={t.id} onClick={() => onStart(t.layers, t.viz)} className="flex flex-col rounded-xl border border-border bg-card p-3 text-left transition-transform hover:-translate-y-0.5 hover:border-primary">
                    <span className="text-[13px] font-semibold text-card-foreground">{t.name}</span>
                    <span className="mt-0.5 text-[11.5px] text-muted-foreground">{t.blurb}</span>
                    <span className="mt-2 flex items-center gap-1.5 font-mono text-[9.5px] uppercase text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5">{VIZ_META[t.viz].label}</span>
                      <span>{t.layers.length} layers</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card p-3.5">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Saved perspectives</p>
            {saved.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">None yet — save a view from the workspace.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {saved.map((v) => (
                  <button key={v.id} onClick={() => onStart(v.layers, v.viz)} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-[12.5px] text-card-foreground hover:border-primary/50">
                    {v.title}
                    <span className="block font-mono text-[10px] text-muted-foreground">{VIZ_META[v.viz].label} · {v.layers.length} layers</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-3.5">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-warning">Data-quality alerts</p>
            <div className="flex flex-col gap-1">
              {alerts.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-[11.5px]">
                  <span className="text-card-foreground">{l.name}</span>
                  <span className="font-mono text-[9.5px] uppercase" style={{ color: l.status === "planned" ? "var(--muted-foreground)" : "var(--warning)" }}>{l.status}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// ── Workspace (§4) ──────────────────────────────────────
function Workspace({ initial, onHome, onSave, saved }: { initial: { layers: string[]; viz: VizType }; onHome: () => void; onSave: (v: SavedView) => void; saved: SavedView[] }) {
  const router = useRouter();
  const openEvidence = useEvidence();
  const decisions = useDecisions();
  const { role } = useRole();

  const [layerIds, setLayerIds] = useState<string[]>(initial.layers);
  const [viz, setViz] = useState<VizType>(initial.viz);
  const [liveOnly, setLiveOnly] = useState(false);
  const [perspectives, setPerspectives] = useState<Perspective[]>([{ label: "Perspective 1", layers: initial.layers, viz: initial.viz }]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [comparePick, setComparePick] = useState<number | null>(null);

  const active = layerIds.map(getLayer).filter((l): l is Layer => !!l).filter((l) => (liveOnly ? l.status === "live" : true));
  const commentary = useMemo(() => localCommentary(active, null), [active]);

  const pushPerspective = (ids: string[], v: VizType, label: string) => setPerspectives((prev) => [...prev, { label: `Perspective ${prev.length + 1} — ${label}`, layers: ids, viz: v }]);

  const addLayer = (l: Layer) => {
    if (layerIds.includes(l.id)) return;
    const c = assess(l, active);
    if (c.state === "incompatible") {
      setBlocked(`${l.name}: ${c.reason}`);
      return;
    }
    const next = [...layerIds, l.id];
    setLayerIds(next);
    setBlocked(null);
    setAiReply(null);
    pushPerspective(next, viz, `+ ${l.name}`);
  };
  const removeLayer = (id: string) => {
    const next = layerIds.filter((x) => x !== id);
    setLayerIds(next);
    pushPerspective(next, viz, `− ${getLayer(id)?.name}`);
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = layerIds.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= layerIds.length) return;
    const next = [...layerIds];
    [next[i], next[j]] = [next[j], next[i]];
    setLayerIds(next);
  };

  async function askAi() {
    setAiBusy(true);
    setAiReply(null);
    const prompt = `I'm looking at a data visualisation. Visual: ${VIZ_META[viz].label}. Layers: ${active.map((l) => `${l.name} (${l.status}, ${l.unit})`).join(", ")}. A local read found: ${commentary.shows} ${commentary.changed}. In 3-4 sentences, elaborate on what this may indicate, one alternative explanation, and one thing to investigate next. Use association language, never claim causation, and flag any demo data.`;
    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, advisor: "evidence", context: { stakeholder: role.stakeholder, name: role.name, org: role.org, country: role.country, port: role.port, objectives: role.objectives } }),
      });
      const data = await res.json();
      setAiReply(data.status === "live" ? data.reply : "AI Advisor isn't configured in this environment — the local read above still applies. It elaborates once ANTHROPIC_API_KEY is set.");
    } catch {
      setAiReply("Couldn't reach the AI Advisor — the local read above still applies.");
    } finally {
      setAiBusy(false);
    }
  }

  function createDecision() {
    const a = active[0];
    if (!a) return;
    const b = active[1];
    const r = b ? pearson(a.values, b.values) : 0;
    const id = `dec-viz-${Date.now().toString(36)}`;
    decisions.createDecision({
      id,
      sev: commentary.confidence === "High" ? "md" : "gd",
      stakeholder: role.stakeholder,
      problem: b ? `Investigate: ${a.name} vs ${b.name}` : `Investigate: ${a.name} pattern`,
      body: commentary.shows,
      valueAtRisk: { label: "Association", amount: b ? `r = ${r}` : "single-layer" },
      confidence: commentary.confidence === "High" ? 0.8 : commentary.confidence === "Medium" ? 0.55 : 0.35,
      recommendation: commentary.next,
      expectedOutcome: commentary.matters,
      owner: `${role.name} · Analyst`,
      dueDate: "2026-08-15",
      stage: "insight",
      state: "open",
      relatedObjects: active.slice(0, 4).map((l) => ({ label: l.id })),
      watchers: [],
      tasks: [],
      evidence: layerEvidence(a),
      activity: [{ at: new Date().toISOString(), actor: role.name, kind: "created", text: `Raised from a Data Visualisation Centre perspective (${VIZ_META[viz].label}, ${active.length} layers).` }],
      version: 1,
    });
    router.push(`/decision/${id}`);
  }

  function save() {
    if (active.length === 0) return;
    onSave({ id: `view-${Date.now().toString(36)}`, title: active.map((l) => l.name).join(" × ").slice(0, 60), layers: layerIds, viz, at: new Date().toISOString() });
    setBlocked("Saved to your perspectives.");
  }

  const dataStatus = active.some((l) => l.status === "live") ? (active.every((l) => l.status === "live") ? "Live" : "Live + Demo") : active.length ? "Demo" : "—";
  const avgConf = active.length ? Math.round((active.reduce((s, l) => s + l.confidence, 0) / active.length) * 100) : 0;

  return (
    <>
      {/* Top bar — context + evidence + actions (§4 top bar) */}
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <button onClick={onHome} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-primary hover:bg-muted">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          Centre
        </button>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{active.length} layers · {GEOS.length} geos · </span>
        <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: dataStatus.includes("Live") ? "var(--success)" : "var(--warning)" }}>{dataStatus}</span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">· conf {avgConf}%</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button onClick={save} className="rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Save view</button>
          <button onClick={createDecision} disabled={!active.length} className="rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-primary hover:bg-muted disabled:opacity-40">Create decision</button>
          <button onClick={() => router.push("/reports")} className="rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Add to report</button>
          <button onClick={() => router.push("/simulation")} className="rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Simulate</button>
          <button onClick={() => window.print()} className="rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Export</button>
        </div>
      </div>

      {blocked && <p className="mb-3 rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-2 text-[12px] text-warning print:hidden">{blocked}</p>}

      <div className="grid items-start gap-3 lg:grid-cols-[236px_minmax(0,1fr)_300px]">
        {/* Left — data & layers */}
        <aside className="flex flex-col gap-3 print:hidden">
          <section className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Active layers</p>
              <label className="flex items-center gap-1 font-mono text-[9.5px] uppercase text-muted-foreground">
                <input type="checkbox" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} className="accent-[var(--primary)]" />Live only
              </label>
            </div>
            {layerIds.length === 0 && <p className="text-[11.5px] text-muted-foreground">No layers — add from the catalogue below.</p>}
            <div className="flex flex-col gap-1">
              {layerIds.map((id, i) => {
                const l = getLayer(id)!;
                return (
                  <div key={id} className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: ["var(--chart-1)", "var(--chart-3)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"][i % 5] }} />
                    <button onClick={() => openEvidence(layerEvidence(l))} className="min-w-0 flex-1 truncate text-left text-[11.5px] text-card-foreground hover:text-primary" title="Open evidence">{l.name}</button>
                    <button onClick={() => move(id, -1)} className="text-muted-foreground hover:text-foreground" aria-label="Move up"><svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg></button>
                    <button onClick={() => removeLayer(id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove"><svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Add a layer</p>
            <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
              {CATEGORIES.map((cat) => {
                const items = LAYERS.filter((l) => l.category === cat && !layerIds.includes(l.id));
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="pb-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{cat}</p>
                    {items.map((l) => {
                      const c = assess(l, active);
                      return (
                        <button key={l.id} onClick={() => addLayer(l)} title={c.reason} className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-muted">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COMPAT_VAR[c.state] }} />
                          <span className="min-w-0 flex-1 truncate text-[11.5px] text-card-foreground">{l.name}</span>
                          <span className="font-mono text-[8.5px] uppercase" style={{ color: l.status === "live" ? "var(--success)" : l.status === "planned" ? "var(--muted-foreground)" : "var(--warning)" }}>{l.status}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 border-t border-border pt-1.5 font-mono text-[9px] text-muted-foreground">● dot = compatibility. Hover any layer for the reason.</p>
          </section>
        </aside>

        {/* Centre — canvas */}
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1 print:hidden">
            {VIZ_TYPES.map((v) => (
              <button
                key={v}
                onClick={() => { setViz(v); pushPerspective(layerIds, v, `view: ${VIZ_META[v].label}`); }}
                title={VIZ_META[v].needs}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium ${viz === v ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={VIZ_META[v].icon} /></svg>
                {VIZ_META[v].label}
              </button>
            ))}
          </div>
          <div className="hidden print:mb-3 print:block">
            <h1 className="font-heading text-[20px] font-bold text-foreground">Data Visualisation — {active.map((l) => l.name).join(" × ")}</h1>
            <p className="text-[11px] text-muted-foreground">{VIZ_META[viz].label} · {dataStatus} · confidence {avgConf}%</p>
          </div>
          <Canvas viz={viz} layers={active} />
        </div>

        {/* Right — AI Advisor (§14) + perspectives */}
        <aside className="flex flex-col gap-3 print:hidden">
          <section className="rounded-xl border border-brand-blue/20 bg-brand-light-blue p-3 dark:bg-muted">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" /></svg>
                AI Advisor
              </p>
              <span className="rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase" style={{ color: commentary.confidence === "High" ? "var(--success)" : commentary.confidence === "Medium" ? "var(--warning)" : "var(--muted-foreground)", background: "color-mix(in srgb,var(--card) 60%,transparent)" }}>{commentary.confidence} confidence</span>
            </div>
            <Read label="What the data shows" text={commentary.shows} />
            {commentary.changed && <Read label="What changed" text={commentary.changed} />}
            <Read label="Why it may matter" text={commentary.matters} />
            {commentary.alternatives.length > 0 && <ReadList label="Alternative explanations" items={commentary.alternatives} />}
            {commentary.limitations.length > 0 && <ReadList label="Data limitations" items={commentary.limitations} />}
            <Read label="Investigate next" text={commentary.next} />
            <button onClick={askAi} disabled={aiBusy || active.length === 0} className="mt-2 w-full rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
              {aiBusy ? "Asking…" : "Ask AI Advisor to elaborate"}
            </button>
            {aiReply && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-card/70 p-2 text-[12px] leading-relaxed text-foreground">{aiReply}</p>}
            <p className="mt-2 font-mono text-[9px] text-muted-foreground">Association ≠ causation. Demo layers are illustrative.</p>
          </section>

          <section className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Perspective history</p>
            <div className="flex flex-col gap-1">
              {perspectives.map((pp, i) => (
                <button
                  key={i}
                  onClick={() => { setLayerIds(pp.layers); setViz(pp.viz); }}
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[11.5px] ${comparePick === i ? "bg-surface-active text-primary" : "text-card-foreground hover:bg-muted"}`}
                >
                  <span className="truncate">{pp.label}</span>
                  <span className="shrink-0 font-mono text-[9px] text-muted-foreground">{pp.layers.length}L</span>
                </button>
              ))}
            </div>
            {perspectives.length > 1 && (
              <button onClick={() => setComparePick(comparePick === null ? perspectives.length - 2 : null)} className="mt-2 w-full rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted">
                {comparePick === null ? "Compare with previous" : "Hide comparison"}
              </button>
            )}
            {comparePick !== null && (
              <p className="mt-2 rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground">
                <b className="text-card-foreground">Difference:</b> {diffText(perspectives[comparePick], perspectives[perspectives.length - 1])}
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function diffText(a: Perspective, b: Perspective): string {
  const added = b.layers.filter((l) => !a.layers.includes(l)).map((id) => getLayer(id)?.name);
  const removed = a.layers.filter((l) => !b.layers.includes(l)).map((id) => getLayer(id)?.name);
  const parts = [];
  if (added.length) parts.push(`added ${added.join(", ")}`);
  if (removed.length) parts.push(`removed ${removed.join(", ")}`);
  if (a.viz !== b.viz) parts.push(`view ${VIZ_META[a.viz].label} → ${VIZ_META[b.viz].label}`);
  return parts.length ? parts.join("; ") + "." : "No structural difference.";
}

function Read({ label, text }: { label: string; text: string }) {
  return (
    <div className="mb-1.5">
      <p className="font-mono text-[9px] uppercase tracking-wide text-brand-blue/80">{label}</p>
      <p className="text-[12px] leading-relaxed text-foreground">{text}</p>
    </div>
  );
}
function ReadList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mb-1.5">
      <p className="font-mono text-[9px] uppercase tracking-wide text-brand-blue/80">{label}</p>
      <ul className="list-disc pl-4">
        {items.map((it) => <li key={it} className="text-[11.5px] leading-relaxed text-muted-foreground">{it}</li>)}
      </ul>
    </div>
  );
}

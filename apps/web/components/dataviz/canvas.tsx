"use client";

import { GEOS, layerEvidence, type Layer } from "@/lib/dataviz/catalogue";
import { pearson } from "@/lib/dataviz/analysis";
import { useEvidence } from "@/components/evidence/evidence-drawer";
import type { VizType } from "@/lib/dataviz/viz";

/**
 * Visualisation canvas (spec §9). Renders the active layers as one of six
 * views — map, scatter, bar, line, heatmap, network. Marks are clickable and
 * open the Evidence drawer (§20); provenance is encoded throughout. Self-
 * contained SVG so it works offline (no map tiles / chart CDN).
 */

const SERIES = ["var(--chart-1)", "var(--chart-3)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"];

function norm(v: number, min: number, max: number) {
  return max === min ? 0.5 : (v - min) / (max - min);
}

export function Canvas({ viz, layers }: { viz: VizType; layers: Layer[] }) {
  const open = useEvidence();
  const withData = layers.filter((l) => l.values.length > 0);

  if (withData.length === 0) {
    return <Empty msg="Add a layer with data to render a visualisation." />;
  }

  if (viz === "scatter") {
    if (withData.length < 2) return <Empty msg="Scatter needs two layers — add a second to plot x against y." />;
    return <Scatter a={withData[0]} b={withData[1]} onOpen={open} />;
  }
  if (viz === "map") return <MapView layers={withData} onOpen={open} />;
  if (viz === "bar") return <Bars layers={withData} onOpen={open} />;
  if (viz === "line") return <Lines layers={withData} />;
  if (viz === "heatmap") return <Heat layers={withData} onOpen={open} />;
  return <Network layers={withData} />;
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="grid h-full min-h-[420px] place-items-center rounded-xl border border-dashed border-border bg-card">
      <p className="max-w-[40ch] px-6 text-center text-[13px] text-muted-foreground">{msg}</p>
    </div>
  );
}

function ProvenanceKey({ layers }: { layers: Layer[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {layers.map((l, i) => (
        <span key={l.id} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />
          {l.name}
          <span className="font-mono text-[9px] uppercase" style={{ color: l.status === "live" ? "var(--success)" : l.status === "demo" ? "var(--warning)" : "var(--muted-foreground)" }}>· {l.status}</span>
        </span>
      ))}
    </div>
  );
}

// ── Scatter (correlation) ───────────────────────────────
function Scatter({ a, b, onOpen }: { a: Layer; b: Layer; onOpen: (e: ReturnType<typeof layerEvidence>) => void }) {
  const W = 620, H = 400, pad = 48;
  const ax = { min: Math.min(...a.values), max: Math.max(...a.values) };
  const bx = { min: Math.min(...b.values), max: Math.max(...b.values) };
  const r = pearson(a.values, b.values);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[13px] font-semibold text-card-foreground">{a.name} <span className="text-muted-foreground">vs</span> {b.name}</p>
        <span className="font-mono text-[12px] tabular-nums" style={{ color: Math.abs(r) >= 0.4 ? "var(--primary)" : "var(--muted-foreground)" }}>r = {r}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Scatter of ${a.name} against ${b.name}`}>
        <line x1={pad} y1={H - pad} x2={W - 12} y2={H - pad} stroke="var(--chart-axis)" />
        <line x1={pad} y1={12} x2={pad} y2={H - pad} stroke="var(--chart-axis)" />
        <text x={(W + pad) / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--chart-ink-muted)">{a.name} ({a.unit})</text>
        <text x={16} y={(H - pad) / 2} textAnchor="middle" fontSize="11" fill="var(--chart-ink-muted)" transform={`rotate(-90 16 ${(H - pad) / 2})`}>{b.name} ({b.unit})</text>
        {a.values.map((_, i) => {
          const x = pad + norm(a.values[i], ax.min, ax.max) * (W - pad - 24);
          const y = H - pad - norm(b.values[i], bx.min, bx.max) * (H - pad - 24);
          return (
            <g key={i} className="cursor-pointer" onClick={() => onOpen(layerEvidence(a))}>
              <circle cx={x} cy={y} r="6" fill="var(--chart-1)" opacity="0.85" />
              <text x={x} y={y - 10} textAnchor="middle" fontSize="9.5" fill="var(--chart-ink-secondary)">{GEOS[i].name}</text>
            </g>
          );
        })}
      </svg>
      <ProvenanceKey layers={[a, b]} />
    </div>
  );
}

// ── Map (SVG point map) ─────────────────────────────────
function MapView({ layers, onOpen }: { layers: Layer[]; onOpen: (e: ReturnType<typeof layerEvidence>) => void }) {
  const size = layers[0];
  const colour = layers[1];
  const W = 620, H = 430;
  // Project lng/lat (Africa bbox ~ lng -20..55, lat -35..38) to canvas.
  const px = (lng: number) => ((lng + 20) / 75) * (W - 40) + 20;
  const py = (lat: number) => ((38 - lat) / 73) * (H - 40) + 20;
  const sMin = Math.min(...size.values), sMax = Math.max(...size.values);
  const cMin = colour ? Math.min(...colour.values) : 0, cMax = colour ? Math.max(...colour.values) : 1;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-1 text-[13px] font-semibold text-card-foreground">
        Point map — size: {size.name}{colour ? ` · colour: ${colour.name}` : ""}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: "color-mix(in srgb,var(--chart-1) 4%,var(--card))" }} role="img" aria-label="Gateway point map">
        {GEOS.map((g, i) => {
          const x = px(g.lng), y = py(g.lat);
          const rad = 8 + norm(size.values[i], sMin, sMax) * 20;
          const t = colour ? norm(colour.values[i], cMin, cMax) : 0.5;
          const fill = colour ? `color-mix(in srgb, var(--chart-6) ${Math.round(t * 100)}%, var(--chart-2))` : "var(--chart-1)";
          return (
            <g key={g.id} className="cursor-pointer" onClick={() => onOpen(layerEvidence(size))}>
              <circle cx={x} cy={y} r={rad} fill={fill} opacity="0.7" stroke="var(--card)" strokeWidth="1.5" />
              <text x={x} y={y - rad - 3} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--chart-ink)">{g.name}</text>
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fill="#fff">{size.values[i]}</text>
            </g>
          );
        })}
      </svg>
      <ProvenanceKey layers={layers.slice(0, 2)} />
    </div>
  );
}

// ── Bars (ranked, grouped) ──────────────────────────────
function Bars({ layers, onOpen }: { layers: Layer[]; onOpen: (e: ReturnType<typeof layerEvidence>) => void }) {
  const shown = layers.slice(0, 3);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-[13px] font-semibold text-card-foreground">By gateway — {shown.map((l) => l.name).join(" · ")}</p>
      <div className="flex flex-col gap-3">
        {GEOS.map((g, gi) => (
          <div key={g.id} className="grid grid-cols-[110px_1fr] items-center gap-3">
            <span className="truncate text-[12px] text-muted-foreground">{g.name}</span>
            <div className="flex flex-col gap-1">
              {shown.map((l, li) => {
                const max = Math.max(...l.values);
                return (
                  <button key={l.id} onClick={() => onOpen(layerEvidence(l))} className="group flex items-center gap-2" title={`${l.name}: ${l.values[gi]} ${l.unit}`}>
                    <span className="h-3 rounded-sm transition-opacity group-hover:opacity-80" style={{ width: `${(l.values[gi] / max) * 100}%`, background: SERIES[li % SERIES.length], minWidth: 2 }} />
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{l.values[gi]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <ProvenanceKey layers={shown} />
    </div>
  );
}

// ── Lines (12-month series) ─────────────────────────────
function Lines({ layers }: { layers: Layer[] }) {
  const shown = layers.slice(0, 4);
  const W = 620, H = 320, pad = 34;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-1 text-[13px] font-semibold text-card-foreground">12-month trend (indexed to each layer's own range)</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Trend lines">
        <line x1={pad} y1={H - pad} x2={W - 8} y2={H - pad} stroke="var(--chart-axis)" />
        {shown.map((l, li) => {
          const min = Math.min(...l.series), max = Math.max(...l.series);
          const d = l.series
            .map((v, i) => `${i ? "L" : "M"}${(pad + (i / 11) * (W - pad - 8)).toFixed(1)},${(H - pad - norm(v, min, max) * (H - pad - 12)).toFixed(1)}`)
            .join(" ");
          return <path key={l.id} d={d} fill="none" stroke={SERIES[li % SERIES.length]} strokeWidth="2" />;
        })}
      </svg>
      <ProvenanceKey layers={shown} />
    </div>
  );
}

// ── Heatmap (geo × layer) ───────────────────────────────
function Heat({ layers, onOpen }: { layers: Layer[]; onOpen: (e: ReturnType<typeof layerEvidence>) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-[13px] font-semibold text-card-foreground">Heat matrix — gateway × layer (shaded within each layer)</p>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="p-1 text-left font-mono text-[9.5px] uppercase text-muted-foreground">Gateway</th>
            {layers.map((l) => (
              <th key={l.id} className="cursor-pointer p-1 text-center font-medium text-card-foreground hover:text-primary" onClick={() => onOpen(layerEvidence(l))}>{l.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GEOS.map((g, gi) => (
            <tr key={g.id}>
              <td className="p-1 text-muted-foreground">{g.name}</td>
              {layers.map((l) => {
                const min = Math.min(...l.values), max = Math.max(...l.values);
                const t = norm(l.values[gi], min, max);
                const good = l.higherIsBetter ? t : 1 - t;
                return (
                  <td key={l.id} className="p-1 text-center tabular-nums" style={{ background: `color-mix(in srgb, ${good > 0.5 ? "var(--chart-5)" : "var(--chart-6)"} ${Math.round(Math.abs(good - 0.5) * 120)}%, transparent)`, color: "var(--card-foreground)" }}>
                    {l.values[gi]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Network (ontology chain) ────────────────────────────
function Network({ layers }: { layers: Layer[] }) {
  const nodes = ["Port", "Corridor", "Project", "DFI", "SDG 9"];
  const W = 620, H = 300;
  const step = (W - 80) / (nodes.length - 1);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-1 text-[13px] font-semibold text-card-foreground">Ontology chain — every layer resolves to a canonical object</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ontology network">
        {nodes.map((n, i) => {
          const x = 40 + i * step, y = H / 2;
          return (
            <g key={n}>
              {i < nodes.length - 1 && <line x1={x} y1={y} x2={x + step} y2={y} stroke="var(--border-strong)" strokeWidth="1.5" />}
              <circle cx={x} cy={y} r="26" fill="var(--surface-active)" stroke="var(--primary)" strokeWidth="1.5" />
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--primary)">{n}</text>
            </g>
          );
        })}
        {layers.slice(0, 3).map((l, i) => (
          <text key={l.id} x={40 + i * step} y={H / 2 + 52} textAnchor="middle" fontSize="9.5" fill="var(--chart-ink-secondary)">{l.name}</text>
        ))}
      </svg>
      <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">Relational overlay — combine datasets through ontology relationships (Port → Corridor → Project → DFI → SDG).</p>
    </div>
  );
}

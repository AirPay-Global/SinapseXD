"use client";

import Link from "next/link";
import { useState } from "react";
import { findPath, LEVEL_LABEL, TWIN_ROOT, type TwinNode } from "@/lib/twin/hierarchy";

/**
 * Digital Twin explorer (UI Evolution spec, Priority 7). One continuous
 * drill: Africa → Region → Country → Corridor → Port → Terminal → Berth →
 * Vessel → Container. Breadcrumb carries the ancestry; the panel shows the
 * current node's KPIs and its children as drillable cards. Levels that need
 * deferred data products (CRM/IoT) are marked planned, not faked.
 */

const STATUS_TEXT: Record<string, string> = { live: "text-success", demo: "text-warning", planned: "text-muted-foreground" };
const STATUS_VAR: Record<string, string> = { live: "var(--success)", demo: "var(--warning)", planned: "var(--muted-foreground)" };

function StatusPill({ status }: { status: TwinNode["status"] }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${STATUS_TEXT[status]}`}
      style={{ background: `color-mix(in srgb, ${STATUS_VAR[status]} 15%, transparent)` }}
    >
      {status}
    </span>
  );
}

export function TwinView() {
  const [currentId, setCurrentId] = useState(TWIN_ROOT.id);
  const path = findPath(TWIN_ROOT, currentId) ?? [TWIN_ROOT];
  const node = path[path.length - 1];
  const children = node.children ?? [];

  return (
    <>
      {/* Hierarchy breadcrumb */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5">
        {path.map((n, i) => (
          <span key={n.id} className="flex items-center gap-1.5">
            {i > 0 && (
              <svg viewBox="0 0 24 24" className="h-3 w-3 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
            )}
            <button
              onClick={() => setCurrentId(n.id)}
              className={`rounded-md px-2 py-1 text-[12px] font-semibold transition-colors ${
                i === path.length - 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="mr-1.5 font-mono text-[9px] uppercase tracking-[0.08em] opacity-70">{LEVEL_LABEL[n.level]}</span>
              {n.name}
            </button>
          </span>
        ))}
      </div>

      {/* Current node */}
      <div className="mb-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Digital twin · {LEVEL_LABEL[node.level]}</p>
            <h2 className="mt-0.5 font-heading text-[22px] font-bold text-foreground">{node.name}</h2>
          </div>
          <span className="ml-auto flex items-center gap-2">
            {node.href && (
              <Link href={node.href} className="rounded-md border border-border px-2.5 py-1 text-[11.5px] font-semibold text-primary hover:bg-muted">
                Object profile →
              </Link>
            )}
            <StatusPill status={node.status} />
          </span>
        </div>
        <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
          {node.kpis.map((k) => (
            <div key={k.name} className="rounded-lg border border-border bg-background px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">{k.name}</p>
              <p className="mt-0.5 font-heading text-[17px] font-extrabold tabular-nums text-foreground">{k.value}</p>
            </div>
          ))}
        </div>
        {node.note && <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">{node.note}</p>}
      </div>

      {/* Children drill */}
      {children.length > 0 ? (
        <>
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Drill into · {LEVEL_LABEL[children[0].level]} level
          </p>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setCurrentId(c.id)}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 text-left transition-transform hover:-translate-y-0.5 hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{LEVEL_LABEL[c.level]}</span>
                  <StatusPill status={c.status} />
                </div>
                <span className="text-[14px] font-semibold text-card-foreground">{c.name}</span>
                <span className="mt-auto flex flex-wrap gap-x-3 gap-y-0.5">
                  {c.kpis.slice(0, 2).map((k) => (
                    <span key={k.name} className="text-[11px] text-muted-foreground">
                      {k.name}: <b className="tabular-nums text-card-foreground">{k.value}</b>
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-3.5 text-[12px] text-muted-foreground">
          {node.level === "container"
            ? "This is the bottom of the twin — a single tracked container."
            : "No deeper twin nodes here yet — deeper levels light up as their data products come online."}
        </p>
      )}
    </>
  );
}

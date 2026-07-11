"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { confidenceBand, type EvidenceRecord, type LineageStage } from "@/lib/evidence/types";

/**
 * The Evidence drawer + its provider (Design Bible §8). Any client component
 * under <EvidenceProvider> can call useEvidence()(record) to slide it open —
 * this is the "click any value → see how it was produced" interaction that
 * makes the data lake visible.
 */

type OpenFn = (record: EvidenceRecord) => void;
const EvidenceContext = createContext<OpenFn>(() => {});
export const useEvidence = () => useContext(EvidenceContext);

const ZONE = {
  bronze: { label: "B", bg: "#b06a2c" },
  silver: { label: "S", bg: "#6b7f96" },
  gold: { label: "G", bg: "var(--accent)" },
} as const;

export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<EvidenceRecord | null>(null);
  const open = useCallback<OpenFn>((r) => setRecord(r), []);
  const close = useCallback(() => setRecord(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <EvidenceContext.Provider value={open}>
      {children}
      <Drawer record={record} onClose={close} />
    </EvidenceContext.Provider>
  );
}

function Stage({ stage }: { stage: LineageStage }) {
  const z = ZONE[stage.zone];
  return (
    <div className="flex gap-3 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold text-white"
          style={{ background: z.bg, color: stage.zone === "gold" ? "var(--accent-foreground)" : "#fff" }}
        >
          {z.label}
        </span>
        <span className="my-1 w-0.5 flex-1 bg-border last:hidden" />
      </div>
      <div className="min-w-0 pb-1">
        <div className="text-[13px] font-semibold text-card-foreground">
          {stage.title}
          <span className="ml-1.5 font-mono text-[9.5px] font-normal text-muted-foreground">{stage.locator}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{stage.detail}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {stage.sources.map((s) => (
            <span key={s} className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Drawer({ record, onClose }: { record: EvidenceRecord | null; onClose: () => void }) {
  const open = record !== null;
  const pct = record ? Math.round(record.confidence * 100) : 0;
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[rgba(4,10,20,0.55)] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-screen w-[min(460px,92vw)] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {record && (
          <>
            <header className="flex items-start gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">Evidence · how this was produced</p>
                <h2 className="mt-1 text-[17px] font-bold text-foreground">{record.metric}</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close evidence"
                className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 pb-10 pt-4">
              <div className="mb-5 flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <div className="font-heading text-4xl font-extrabold tabular-nums text-card-foreground">{record.value}</div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{record.objectRef}</p>
                  <div className="mt-0.5 text-xs text-muted-foreground">{record.asOf}</div>
                </div>
              </div>

              <section className="mb-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Confidence</p>
                  <div className="h-2 overflow-hidden rounded-full border border-border bg-card">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,var(--chart-1),var(--brand-blue))" }} />
                  </div>
                  <div className="mt-1.5 font-mono text-[11.5px] text-muted-foreground">
                    {record.confidence.toFixed(2)} — {confidenceBand(record.confidence)}
                  </div>
                </div>
                <div>
                  <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Quality score</p>
                  {record.qualityScore !== undefined ? (
                    <>
                      <div className="h-2 overflow-hidden rounded-full border border-border bg-card">
                        <span className="block h-full rounded-full" style={{ width: `${Math.round(record.qualityScore * 100)}%`, background: "var(--success)" }} />
                      </div>
                      <div className="mt-1.5 font-mono text-[11.5px] text-muted-foreground">
                        {record.qualityScore.toFixed(2)} · {record.status ?? "live"}
                      </div>
                    </>
                  ) : (
                    <div className="font-mono text-[11.5px] text-muted-foreground">not yet scored · {record.status ?? "live"}</div>
                  )}
                </div>
              </section>

              <section className="mb-6">
                <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Data lineage — Bronze → Silver → Gold
                </p>
                <div className="flex flex-col">
                  {record.lineage.map((s, i) => (
                    <Stage key={i} stage={s} />
                  ))}
                </div>
              </section>

              <section className="mb-6">
                <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Validation rules</p>
                {record.validations?.length ? (
                  <div className="flex flex-col gap-1">
                    {record.validations.map((v) => (
                      <div key={v.rule} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full font-mono text-[9px] font-bold text-white ${v.passed ? "bg-success" : "bg-destructive"}`}>
                          {v.passed ? "✓" : "✕"}
                        </span>
                        <span className="font-mono text-[11px] text-card-foreground">{v.rule}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
                    No data-contract checks registered for this mart yet.
                  </p>
                )}
              </section>

              <section className="mb-6">
                <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Refresh history</p>
                {record.refreshHistory?.length ? (
                  <div className="flex flex-col gap-1">
                    {record.refreshHistory.map((r, i) => (
                      <div key={i} className="flex items-baseline gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                        <span className={`font-mono text-[10px] font-bold uppercase ${r.outcome === "ok" ? "text-success" : r.outcome === "late" ? "text-warning" : "text-destructive"}`}>
                          {r.outcome}
                        </span>
                        <time className="font-mono text-[11px] text-muted-foreground">{r.at}</time>
                        {r.note && <span className="min-w-0 truncate text-[11px] text-muted-foreground">{r.note}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
                    Refresh log starts once the pipeline runs this mart on a schedule.
                  </p>
                )}
                <p className="mt-2 flex items-center justify-between font-mono text-[10.5px] text-muted-foreground">
                  <span>Data steward</span>
                  <span className="text-card-foreground">{record.steward ?? "unassigned"}</span>
                </p>
              </section>

              {record.recommendation && (
                <section>
                  <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Recommended action</p>
                  <div className="rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb,var(--accent) 30%,transparent)", background: "color-mix(in srgb,var(--accent) 9%,var(--card))" }}>
                    <p className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">Sinapse recommends</p>
                    <p className="text-[13px] text-foreground">{record.recommendation}</p>
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

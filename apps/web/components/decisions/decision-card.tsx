"use client";

import Link from "next/link";
import { useState } from "react";
import { useEvidence } from "@/components/evidence/evidence-drawer";
import { useDecisions } from "@/components/decisions/decision-store";
import { STAGE_LABEL, STATE_LABEL, type DecisionItem } from "@/lib/decisions/types";

/**
 * Decision card as an operational work item (spec Priority 1): problem, value
 * at risk, confidence, recommendation, expected outcome, owner, due date,
 * related ontology objects, evidence — plus the full action set. Inline
 * actions that need input (modify / delegate / schedule / reject) open a small
 * panel inside the card; everything else is one click.
 */

const SEV_BAR: Record<DecisionItem["sev"], string> = { hi: "bg-destructive", md: "bg-accent", gd: "bg-success" };

/** Tailwind can't alpha var-based colors, so tinted badges use color-mix inline. */
export const STATE_TONE: Record<DecisionItem["state"], { cls: string; bg?: string }> = {
  open: { cls: "border border-border text-muted-foreground" },
  accepted: { cls: "text-success", bg: "var(--success)" },
  rejected: { cls: "text-destructive", bg: "var(--destructive)" },
  modified: { cls: "text-info", bg: "var(--info)" },
  delegated: { cls: "text-info", bg: "var(--info)" },
  scheduled: { cls: "text-info", bg: "var(--info)" },
  investigating: { cls: "text-warning", bg: "var(--warning)" },
};

export function StateBadge({ state }: { state: DecisionItem["state"] }) {
  const t = STATE_TONE[state];
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase ${t.cls}`}
      style={t.bg ? { background: `color-mix(in srgb, ${t.bg} 13%, transparent)` } : undefined}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

type Panel = "modify" | "delegate" | "schedule" | "reject" | null;

function ActionChip({ label, onClick, tone }: { label: string; onClick: () => void; tone?: "danger" }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border border-border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted ${
        tone === "danger" ? "text-destructive hover:border-destructive/40" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function DecisionCard({ decision: d }: { decision: DecisionItem }) {
  const openEvidence = useEvidence();
  const api = useDecisions();
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState("");

  const openPanel = (p: Exclude<Panel, null>) => {
    setPanel(panel === p ? null : p);
    setDraft(p === "modify" ? d.recommendation : p === "schedule" ? d.dueDate : "");
  };

  const confirmPanel = () => {
    const text = draft.trim();
    if (panel === "modify" && text) api.modify(d.id, text);
    if (panel === "delegate" && text) api.delegate(d.id, text);
    if (panel === "schedule" && text) api.schedule(d.id, text);
    if (panel === "reject") api.reject(d.id, text || undefined);
    setPanel(null);
    setDraft("");
  };

  const decided = d.state !== "open";

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex gap-3 px-4 pb-3 pt-4">
        <div className={`w-[3px] shrink-0 rounded ${SEV_BAR[d.sev]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{d.stakeholder}</span>
            <span className="ml-auto"><StateBadge state={d.state} /></span>
          </div>
          <Link href={`/decision/${d.id}`} className="mt-0.5 block text-[15px] font-semibold leading-snug text-card-foreground hover:text-primary">
            {d.problem}
          </Link>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">{d.body}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.relatedObjects.map((o) =>
              o.href ? (
                <Link key={o.label} href={o.href} className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-primary hover:bg-muted">
                  {o.label}
                </Link>
              ) : (
                <span key={o.label} className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {o.label}
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="mx-4 mb-2.5 rounded-lg border p-3" style={{ borderColor: "color-mix(in srgb,var(--accent) 34%,transparent)", background: "color-mix(in srgb,var(--accent) 10%,var(--card))" }}>
        <p className="mb-1 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" /></svg>
          Recommended action{d.version > 1 && <span className="normal-case tracking-normal">· v{d.version}</span>}
        </p>
        <p className="text-[13px] font-medium text-foreground">{d.recommendation}</p>
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          <b className="font-semibold text-foreground/80">Expected outcome:</b> {d.expectedOutcome}
        </p>
      </div>

      <div className="mx-4 mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground sm:grid-cols-4">
        <span>{d.valueAtRisk.label}<br /><b className="text-[12.5px] tabular-nums text-foreground">{d.valueAtRisk.amount}</b></span>
        <span>Confidence<br /><b className="text-[12.5px] tabular-nums text-foreground">{Math.round(d.confidence * 100)}%</b></span>
        <span>Owner<br /><b className="text-[12px] text-foreground">{d.owner.split("·")[0].trim()}</b></span>
        <span>Due<br /><b className="text-[12px] tabular-nums text-foreground">{d.dueDate}</b></span>
      </div>

      {panel && (
        <div className="mx-4 mb-3 rounded-lg border border-border bg-background p-2.5">
          <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
            {panel === "modify" ? "Modify recommendation" : panel === "delegate" ? "Delegate to" : panel === "schedule" ? "Schedule decision" : "Reject — reason (optional)"}
          </p>
          <div className="flex gap-2">
            {panel === "schedule" ? (
              <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-primary" />
            ) : (
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={panel === "delegate" ? "e.g. T. Naidoo · Commercial Director" : ""}
                className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-primary"
              />
            )}
            <button onClick={confirmPanel} className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground">Confirm</button>
            <button onClick={() => setPanel(null)} className="rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {!decided && (
            <button onClick={() => api.accept(d.id)} className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90">
              Accept
            </button>
          )}
          <ActionChip label="Modify" onClick={() => openPanel("modify")} />
          <ActionChip label="Delegate" onClick={() => openPanel("delegate")} />
          <ActionChip label="Schedule" onClick={() => openPanel("schedule")} />
          <ActionChip label="Workflow" onClick={() => api.launchWorkflow(d.id)} />
          <ActionChip label="Investigate" onClick={() => api.openInvestigation(d.id)} />
          {!decided && <ActionChip label="Reject" tone="danger" onClick={() => openPanel("reject")} />}
          <span className="ml-auto flex items-center gap-1.5">
            <Link href={`/simulation?decision=${d.id}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
              Simulate
            </Link>
            <button onClick={() => openEvidence(d.evidence)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-primary hover:bg-muted">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>
              Evidence
            </button>
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>Lifecycle · {STAGE_LABEL[d.stage]}</span>
          <span className="ml-auto normal-case tracking-normal">{d.watchers.length} watching · {d.activity.length} events</span>
        </div>
      </div>
    </article>
  );
}

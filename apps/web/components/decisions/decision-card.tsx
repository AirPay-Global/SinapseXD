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

export function DecisionCard({ decision: d }: { decision: DecisionItem }) {
  const openEvidence = useEvidence();
  const api = useDecisions();
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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
  // Action hierarchy (§9): one primary, two secondary (Simulate/Evidence),
  // the rest behind an overflow menu.
  const primary = !decided
    ? { label: "Accept", onClick: () => api.accept(d.id) }
    : d.tasks.length === 0
      ? { label: "Launch workflow", onClick: () => api.launchWorkflow(d.id) }
      : null;

  const menuItems: Array<{ label: string; onClick: () => void; tone?: "danger" }> = [
    { label: "Modify recommendation", onClick: () => openPanel("modify") },
    { label: "Delegate", onClick: () => openPanel("delegate") },
    { label: "Schedule", onClick: () => openPanel("schedule") },
    ...(d.tasks.length > 0 || !primary ? [] : primary.label === "Launch workflow" ? [] : [{ label: "Launch workflow", onClick: () => api.launchWorkflow(d.id) }]),
    { label: "Open investigation", onClick: () => api.openInvestigation(d.id) },
    ...(!decided ? [{ label: "Reject", onClick: () => openPanel("reject"), tone: "danger" as const }] : []),
  ];

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex gap-3 px-3.5 pb-2.5 pt-3">
        {/* Severity rail — non-colour cue paired with the state badge (§6/§22) */}
        <div className={`w-[3px] shrink-0 rounded ${SEV_BAR[d.sev]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">{d.stakeholder}</span>
            <span className="ml-auto"><StateBadge state={d.state} /></span>
          </div>
          <Link href={`/decision/${d.id}`} className="mt-0.5 block text-[15px] font-semibold leading-snug text-card-foreground hover:text-primary">
            {d.problem}
          </Link>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{d.body}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.relatedObjects.map((o) =>
              o.href ? (
                <Link key={o.label} href={o.href} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-primary hover:bg-surface-active">
                  {o.label}
                </Link>
              ) : (
                <span key={o.label} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {o.label}
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="mx-3.5 mb-2 rounded-lg p-2.5" style={{ background: "color-mix(in srgb,var(--accent) 9%,var(--card))" }}>
        <p className="mb-1 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" /></svg>
          Recommended action{d.version > 1 && <span className="normal-case tracking-normal">· v{d.version}</span>}
        </p>
        <p className="text-[13px] font-medium text-foreground">{d.recommendation}</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          <b className="font-semibold text-foreground/80">Expected outcome:</b> {d.expectedOutcome}
        </p>
      </div>

      <div className="mx-3.5 mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground sm:grid-cols-4">
        <span>{d.valueAtRisk.label}<br /><b className="text-[12.5px] tabular-nums text-foreground">{d.valueAtRisk.amount}</b></span>
        <span>Confidence<br /><b className="text-[12.5px] tabular-nums text-foreground">{Math.round(d.confidence * 100)}%</b></span>
        <span>Owner<br /><b className="text-[12px] text-foreground">{d.owner.split("·")[0].trim()}</b></span>
        <span>Due<br /><b className="whitespace-nowrap text-[12px] tabular-nums text-foreground">{d.dueDate}</b></span>
      </div>

      {panel && (
        <div className="mx-3.5 mb-2.5 rounded-lg border border-border bg-background p-2.5">
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

      <div className="mt-auto border-t border-border px-3.5 py-2">
        <div className="flex items-center gap-1.5">
          {primary && (
            <button onClick={primary.onClick} className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90">
              {primary.label}
            </button>
          )}
          <Link href={`/simulation?decision=${d.id}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            Simulate
          </Link>
          <button onClick={() => openEvidence(d.evidence)} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-primary hover:bg-muted">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>
            Evidence
          </button>

          <div className="relative ml-auto">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More actions"
              aria-expanded={menuOpen}
              className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
            </button>
            {menuOpen && (
              <>
                <button aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                <div className="absolute bottom-full right-0 z-20 mb-1 w-48 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-[var(--shadow-md)]">
                  {menuItems.map((m) => (
                    <button
                      key={m.label}
                      onClick={() => {
                        m.onClick();
                        setMenuOpen(false);
                      }}
                      className={`flex w-full items-center px-3 py-1.5 text-left text-[12px] hover:bg-muted ${m.tone === "danger" ? "text-destructive" : "text-card-foreground"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                  <Link href={`/decision/${d.id}`} onClick={() => setMenuOpen(false)} className="flex w-full items-center border-t border-border px-3 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground">
                    Open full details →
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>Lifecycle · {STAGE_LABEL[d.stage]}</span>
          <span className="ml-auto normal-case tracking-normal">{d.watchers.length} watching · {d.activity.length} events</span>
        </div>
      </div>
    </article>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreateWizard } from "@/components/reporting/create-wizard";
import { FrameworkChip, StatusBadge } from "@/components/reporting/bits";
import { useReports } from "@/components/reporting/report-store";
import { completion, isOverdue, type Report } from "@/lib/reporting/model";

/**
 * Reporting Centre home (spec §5, §23). Opens on what is due, missing or
 * awaiting action — summary cards act as filters over role-based queues, and
 * "Create report" launches the wizard. Reports reuse the same ontology and
 * Gold metrics as the rest of the platform.
 */

type Filter = "all" | "draft" | "evidence" | "review" | "approval" | "approved" | "published" | "overdue" | "scheduled";

function matches(r: Report, f: Filter): boolean {
  switch (f) {
    case "all": return true;
    case "draft": return r.status === "draft" || r.status === "returned";
    case "evidence": return r.status === "evidence_required";
    case "review": return r.status === "ready_for_review" || r.status === "in_review";
    case "approval": return r.status === "submitted_approval";
    case "approved": return r.status === "approved";
    case "published": return r.status === "published";
    case "overdue": return isOverdue(r);
    case "scheduled": return !!r.scheduled;
  }
}

const CARDS: Array<{ f: Filter; label: string; tone?: string }> = [
  { f: "draft", label: "Drafts" },
  { f: "evidence", label: "Awaiting evidence", tone: "var(--warning)" },
  { f: "review", label: "Awaiting review", tone: "var(--simulation)" },
  { f: "approval", label: "Awaiting approval", tone: "var(--simulation)" },
  { f: "approved", label: "Approved", tone: "var(--success)" },
  { f: "published", label: "Published", tone: "var(--primary)" },
  { f: "overdue", label: "Overdue", tone: "var(--destructive)" },
  { f: "scheduled", label: "Scheduled" },
];

export function ReportingHome() {
  const { reports } = useReports();
  const [filter, setFilter] = useState<Filter>("all");
  const [wizard, setWizard] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const card of CARDS) c[card.f] = reports.filter((r) => matches(r, card.f)).length;
    return c;
  }, [reports]);

  const visible = reports
    .filter((r) => matches(r, filter))
    .sort((a, b) => (isOverdue(b) ? 1 : 0) - (isOverdue(a) ? 1 : 0) || a.dueDate.localeCompare(b.dueDate));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Reporting Centre</p>
          <h1 className="mt-1 font-heading text-[26px] font-bold text-foreground">Generate trusted, evidence-backed reports</h1>
          <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">
            Built from the same ontology objects, Gold metrics and evidence that drive decisions — with full traceability from the
            final report back to its source. Every report has a clear owner, status and audit trail.
          </p>
        </div>
        <button onClick={() => setWizard(true)} className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Create report
        </button>
      </div>

      {/* Summary cards (§5.3) */}
      <div className="mb-5 grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
        {CARDS.map((c) => {
          const active = filter === c.f;
          return (
            <button
              key={c.f}
              onClick={() => setFilter(active ? "all" : c.f)}
              className={`rounded-xl border bg-card p-3 text-left transition-colors ${active ? "border-primary" : "border-border hover:border-border-strong"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-heading text-[26px] font-extrabold tabular-nums" style={{ color: counts[c.f] ? c.tone ?? "var(--foreground)" : "var(--muted-foreground)" }}>{counts[c.f]}</span>
                {c.tone && counts[c.f] > 0 && <span className="h-2 w-2 rounded-full" style={{ background: c.tone }} aria-hidden />}
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{c.label}</p>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="mb-2.5 flex items-baseline gap-2.5">
        <h2 className="text-[15px] font-bold text-foreground">{filter === "all" ? "All reports" : CARDS.find((c) => c.f === filter)?.label}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{visible.length} report{visible.length === 1 ? "" : "s"}</span>
        {filter !== "all" && (
          <button onClick={() => setFilter("all")} className="ml-auto text-[12px] font-semibold text-primary hover:underline">Clear filter</button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            No reports here yet. <button onClick={() => setWizard(true)} className="font-semibold text-primary hover:underline">Start from a framework template</button> or build a custom report.
          </p>
        )}
        {visible.map((r) => {
          const pct = completion(r);
          const overdue = isOverdue(r);
          return (
            <Link key={r.id} href={`/reports/${r.id}`} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FrameworkChip framework={r.framework} />
                  <span className="truncate text-[13.5px] font-semibold text-card-foreground">{r.title}</span>
                </div>
                <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">{r.entityType} · {r.periodLabel} · {r.author.split("·")[0].trim()}</p>
              </div>
              <div className="hidden w-24 shrink-0 sm:block">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">{pct}% complete</p>
              </div>
              <div className="w-24 shrink-0 text-right">
                <span className={`font-mono text-[11px] tabular-nums ${overdue ? "font-bold text-destructive" : "text-muted-foreground"}`}>{r.dueDate}</span>
                {overdue && <p className="font-mono text-[9px] uppercase text-destructive">overdue</p>}
              </div>
              <div className="w-[130px] shrink-0 text-right"><StatusBadge status={r.status} /></div>
            </Link>
          );
        })}
      </div>

      <CreateWizard open={wizard} onClose={() => setWizard(false)} />
    </>
  );
}

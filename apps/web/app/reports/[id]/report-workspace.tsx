"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FrameworkChip, StatusBadge, DataStatusDot } from "@/components/reporting/bits";
import { useReports } from "@/components/reporting/report-store";
import { useEvidence } from "@/components/evidence/evidence-drawer";
import { useRole } from "@/components/role-context";
import { completion, validateReport, type Report, type ReportMetric, type ReportSection } from "@/lib/reporting/model";
import { getTemplate } from "@/lib/reporting/templates";

/**
 * Report workspace (spec §11 three-panel editor + §7 lifecycle). Section
 * navigator with completion/validation on the left, editable content in the
 * middle, and an evidence / AI Advisor / validation / versions / activity rail
 * on the right. A lifecycle action bar drives the report through review and
 * approval (maker-checker enforced); approving seals an immutable version.
 * The `.report-print` block renders the whole report for PDF export.
 */

function MetricCard({ m, onOpen }: { m: ReportMetric; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex flex-col rounded-lg border border-border bg-card p-3 text-left hover:border-primary/50">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-medium text-muted-foreground">{m.name}</span>
        <DataStatusDot status={m.status} />
      </div>
      <div className="mt-1 font-heading text-[22px] font-extrabold tabular-nums text-card-foreground">
        {m.value}{m.unit && <small className="ml-1 text-[12px] font-semibold text-muted-foreground">{m.unit}</small>}
      </div>
      <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5">
        <span className="font-mono text-[10px] text-muted-foreground">conf {Math.round(m.confidence * 100)}%</span>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary">Evidence
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>
        </span>
      </div>
    </button>
  );
}

function MiniTrend({ vals }: { vals: number[] }) {
  const w = 260, h = 60, mx = Math.max(...vals), mn = Math.min(...vals);
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - 4 - ((v - mn) / (mx - mn || 1)) * (h - 8)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="var(--primary)" opacity="0.1" />
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="1.8" />
    </svg>
  );
}

function SectionEditor({ report, section }: { report: Report; section: ReportSection }) {
  const api = useReports();
  const openEvidence = useEvidence();
  const { role } = useRole();
  const [draft, setDraft] = useState(section.content);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const metrics = report.metrics.filter((m) => section.metricRefs.includes(m.id));
  const editable = section.type === "summary" || section.type === "narrative" || section.type === "recommendations" || section.type === "exceptions";
  const seriesMetrics = metrics.filter((m) => m.series && m.series.length > 1);

  async function draftWithAi() {
    setAiBusy(true);
    setAiNote(null);
    const prompt = `Draft the "${section.title}" section for a ${report.templateName} covering ${report.entityLabel}, ${report.periodLabel}. Use ONLY these metrics: ${report.metrics.map((m) => `${m.name} = ${m.value}${m.unit ? " " + m.unit : ""} (${m.status})`).join("; ")}. 3-5 sentences, cite the metric names you use, and flag any demo/planned data as not suitable for official submission.`;
    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, advisor: report.framework === "aprm" || report.framework === "au" ? "governance" : "evidence", context: { stakeholder: role.stakeholder, name: role.name, org: role.org, country: role.country, port: role.port, objectives: role.objectives } }),
      });
      const data = await res.json();
      if (data.status === "live" && data.reply) {
        api.appendAiDraft(report.id, section.id, data.reply, "AI Advisor", "live", prompt);
        setDraft(data.reply);
      } else {
        setAiNote("AI Advisor isn't configured in this environment. You can continue to build the report manually.");
        api.appendAiDraft(report.id, section.id, draft || section.content, "AI Advisor", data.status ?? "demo", prompt);
      }
    } catch {
      setAiNote("Couldn't reach the AI Advisor — try again, or write the section manually.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-heading text-[19px] font-bold text-foreground">{section.title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{section.type}</span>
        {section.aiDrafted && <span className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase" style={{ color: "var(--simulation)", background: "color-mix(in srgb,var(--simulation) 13%,transparent)" }}>AI draft · review</span>}
      </div>

      {section.type === "cover" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{report.templateName} · v{report.templateVersion}</p>
          <p className="mt-2 font-heading text-[26px] font-bold text-foreground">{section.content || report.title}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{report.entityType} · {report.entityLabel} · {report.periodLabel}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Author {report.author} · Confidentiality {report.confidentiality}</p>
        </div>
      )}

      {(section.type === "kpi") && (
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          {metrics.length === 0 && <p className="text-[13px] text-muted-foreground">No metrics selected — add them from the template scope.</p>}
          {metrics.map((m) => <MetricCard key={m.id} m={m} onOpen={() => openEvidence(m.evidence)} />)}
        </div>
      )}

      {section.type === "chart" && (
        <div className="flex flex-col gap-3">
          {seriesMetrics.length === 0 && <p className="text-[13px] text-muted-foreground">No trend metrics in scope.</p>}
          {seriesMetrics.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[12.5px] font-semibold text-card-foreground">{m.name}</span>
                <button onClick={() => openEvidence(m.evidence)} className="font-mono text-[10.5px] font-semibold text-primary hover:underline">Evidence</button>
              </div>
              <MiniTrend vals={m.series!} />
              <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>{report.periodLabel}</span>
                <DataStatusDot status={m.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editable && (
        <div>
          {aiNote && <p className="mb-2 rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-2 text-[12px] text-warning">{aiNote}</p>}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft !== section.content && api.updateSection(report.id, section.id, draft)}
            rows={10}
            className="w-full rounded-xl border border-border bg-card p-3.5 text-[13.5px] leading-relaxed text-foreground outline-none focus:border-primary"
          />
          <div className="mt-2 flex items-center gap-2">
            <button onClick={draftWithAi} disabled={aiBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-muted disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" /></svg>
              {aiBusy ? "Drafting…" : "Draft with AI Advisor"}
            </button>
            <span className="font-mono text-[10.5px] text-muted-foreground">AI drafts stay in review until a human approves (§9).</span>
          </div>
        </div>
      )}

      {section.type === "annexure" && <p className="whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-[12.5px] text-muted-foreground">{section.content}</p>}
    </div>
  );
}

export function ReportWorkspace({ id }: { id: string }) {
  const api = useReports();
  const openEvidence = useEvidence();
  const r = api.get(id);
  const [activeSection, setActiveSection] = useState(0);
  const [comment, setComment] = useState("");

  const checks = useMemo(() => (r ? validateReport(r) : []), [r]);
  const failed = checks.filter((c) => !c.ok);

  if (!r) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Report not found. <Link href="/reports" className="font-semibold text-primary">Back to the Reporting Centre</Link>
      </div>
    );
  }

  const section = r.sections[Math.min(activeSection, r.sections.length - 1)];
  const pct = completion(r);
  const makerChecker = !!r.approver && r.approver !== r.author;

  // Lifecycle actions available for the current status.
  const actions: Array<{ label: string; onClick: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; title?: string }> = [];
  if (["draft", "returned", "evidence_required"].includes(r.status)) actions.push({ label: "Submit for review", primary: true, onClick: () => api.submitReview(r.id) });
  if (r.status === "ready_for_review") actions.push({ label: "Start review", primary: true, onClick: () => api.startReview(r.id) });
  if (r.status === "in_review") {
    actions.push({ label: "Submit for approval", primary: true, onClick: () => api.submitApproval(r.id), disabled: failed.length > 0, title: failed.length ? "Resolve validation failures first" : undefined });
    actions.push({ label: "Return for changes", onClick: () => api.returnForChanges(r.id, "Reviewer requested revisions.") });
  }
  if (r.status === "submitted_approval") {
    actions.push({ label: "Approve", primary: true, onClick: () => api.approve(r.id, "Approved."), disabled: !makerChecker, title: makerChecker ? undefined : "Approver must differ from the author (maker-checker)" });
    actions.push({ label: "Return", onClick: () => api.returnForChanges(r.id, "Approver requested changes.") });
    actions.push({ label: "Reject", danger: true, onClick: () => api.reject(r.id, "Rejected by approver.") });
  }
  if (r.status === "approved") {
    actions.push({ label: "Publish", primary: true, onClick: () => api.publish(r.id) });
    actions.push({ label: "Archive", onClick: () => api.archive(r.id) });
  }
  if (r.status === "published") actions.push({ label: "Archive", onClick: () => api.archive(r.id) });

  return (
    <>
      {/* Screen workspace */}
      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Link href="/reports" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-muted">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
            Reporting Centre
          </Link>
          <FrameworkChip framework={r.framework} />
          <StatusBadge status={r.status} />
          {r.locked && <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">v{r.currentVersion} sealed · editing opens a new version</span>}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M6 14h12v7H6z" /></svg>
              Export PDF
            </button>
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                disabled={a.disabled}
                title={a.title}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40 ${a.primary ? "bg-primary text-primary-foreground hover:opacity-90" : a.danger ? "border border-border text-destructive hover:bg-muted" : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <h1 className="mb-4 font-heading text-[22px] font-bold text-foreground">{r.title}</h1>

        <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
          {/* Left — section navigator */}
          <aside className="rounded-xl border border-border bg-card p-2.5">
            <div className="mb-2 px-1">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">Sections</span>
                <span className="font-mono text-[10px] text-muted-foreground">{pct}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              {r.sections.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(i)}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${i === activeSection ? "bg-surface-active font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.complete ? "bg-success" : "bg-border-strong"}`} aria-hidden />
                  <span className="truncate">{s.title}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Main — editor */}
          <div className="min-w-0 rounded-xl border border-border bg-background p-4">
            <SectionEditor report={r} section={section} />
          </div>

          {/* Right — rail */}
          <aside className="flex flex-col gap-3">
            <RailPanel title={`Validation · ${failed.length === 0 ? "passed" : `${failed.length} to resolve`}`} tone={failed.length ? "warn" : "ok"}>
              <div className="flex flex-col gap-1">
                {checks.map((c) => (
                  <div key={c.rule} className="flex items-start gap-2 text-[11.5px]">
                    <span className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[8px] font-bold text-white ${c.ok ? "bg-success" : "bg-warning"}`}>{c.ok ? "✓" : "!"}</span>
                    <span className="text-card-foreground">{c.rule}<span className="block font-mono text-[10px] text-muted-foreground">{c.detail}</span></span>
                  </div>
                ))}
              </div>
            </RailPanel>

            <RailPanel title="Evidence">
              <div className="flex flex-col gap-1">
                {r.metrics.map((m) => (
                  <button key={m.id} onClick={() => openEvidence(m.evidence)} className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-[11.5px] hover:bg-muted">
                    <span className="min-w-0 truncate text-card-foreground">{m.name}</span>
                    <DataStatusDot status={m.status} />
                  </button>
                ))}
              </div>
            </RailPanel>

            <RailPanel title={`Versions · ${r.versions.length}`}>
              {r.versions.length === 0 ? (
                <p className="font-mono text-[11px] text-muted-foreground">No sealed versions yet — approval creates v1.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {r.versions.map((v) => (
                    <div key={v.number} className="rounded-md border border-border bg-background px-2 py-1.5">
                      <p className="text-[11.5px] font-semibold text-card-foreground">v{v.number} · {v.validationStatus}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{v.at.slice(0, 10)} · snapshot {v.evidenceSnapshotId}</p>
                    </div>
                  ))}
                </div>
              )}
            </RailPanel>

            <RailPanel title="Assignments">
              <div className="flex flex-col gap-2">
                <label className="text-[10.5px] font-medium text-muted-foreground">Reviewer
                  <input value={r.reviewer ?? ""} onChange={(e) => api.setAssignment(r.id, "reviewer", e.target.value)} placeholder="unassigned" className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary" />
                </label>
                <label className="text-[10.5px] font-medium text-muted-foreground">Approver
                  <input value={r.approver ?? ""} onChange={(e) => api.setAssignment(r.id, "approver", e.target.value)} placeholder="unassigned" className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary" />
                </label>
                {!makerChecker && r.approver && <p className="font-mono text-[10px] text-warning">Approver must differ from the author.</p>}
              </div>
            </RailPanel>

            <RailPanel title={`Activity · ${r.activity.length}`}>
              <div className="flex max-h-52 flex-col gap-2 overflow-y-auto">
                {[...r.activity].reverse().map((a, i) => (
                  <div key={i}>
                    <div className="flex items-baseline gap-1.5">
                      <b className="text-[11px] font-semibold text-card-foreground">{a.actor}</b>
                      <time className="font-mono text-[9px] text-muted-foreground">{a.at.slice(0, 16).replace("T", " ")}</time>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground">{a.text}</p>
                  </div>
                ))}
              </div>
              <form className="mt-2 flex gap-1.5 border-t border-border pt-2" onSubmit={(e) => { e.preventDefault(); if (comment.trim()) { api.addComment(r.id, comment.trim()); setComment(""); } }}>
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment…" className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11.5px] text-foreground outline-none focus:border-primary" />
                <button type="submit" disabled={!comment.trim()} className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40">Post</button>
              </form>
            </RailPanel>
          </aside>
        </div>
      </div>

      {/* Print / PDF view — full report */}
      <div className="report-print hidden print:block">
        <ReportPrint report={r} />
      </div>
    </>
  );
}

function RailPanel({ title, tone, children }: { title: string; tone?: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: tone === "warn" ? "var(--warning)" : tone === "ok" ? "var(--success)" : "var(--muted-foreground)" }}>{title}</p>
      {children}
    </section>
  );
}

function ReportPrint({ report: r }: { report: Report }) {
  const tpl = getTemplate(r.templateId);
  return (
    <div className="mx-auto max-w-[720px] text-[#0d2b4e]">
      <div className="mb-6 border-b-2 border-[#0d2b4e] pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5c6b82]">{r.templateName} · v{r.templateVersion}</p>
        <h1 className="mt-1 font-heading text-[28px] font-bold">{r.title}</h1>
        <p className="mt-1 text-[13px] text-[#5c6b82]">{r.entityType} · {r.periodLabel} · {r.confidentiality} · Author {r.author}</p>
        {r.versions.length > 0 && <p className="font-mono text-[11px] text-[#5c6b82]">Approved v{r.currentVersion} · snapshot {r.versions[r.versions.length - 1].evidenceSnapshotId}</p>}
      </div>
      {r.sections.map((s) => {
        const metrics = r.metrics.filter((m) => s.metricRefs.includes(m.id));
        return (
          <section key={s.id} className="mb-5">
            {s.type !== "cover" && <h2 className="mb-2 font-heading text-[16px] font-bold">{s.title}</h2>}
            {s.content && s.type !== "cover" && <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">{s.content}</p>}
            {metrics.length > 0 && (
              <table className="mt-2 w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-[#cdd9ea] text-left text-[#5c6b82]">
                    <th className="py-1">Metric</th><th className="py-1">Value</th><th className="py-1">Status</th><th className="py-1">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id} className="border-b border-[#eef2f8]">
                      <td className="py-1">{m.name}</td>
                      <td className="py-1 font-semibold">{m.value}{m.unit ? ` ${m.unit}` : ""}</td>
                      <td className="py-1 uppercase">{m.status}</td>
                      <td className="py-1">{Math.round(m.confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
      <p className="mt-8 border-t border-[#cdd9ea] pt-3 font-mono text-[10px] text-[#5c6b82]">
        Generated by Sinapse XDi Reporting Centre · {tpl?.audience} · reproducible from evidence snapshot. Demo/planned metrics are illustrative and excluded from official submission.
      </p>
    </div>
  );
}

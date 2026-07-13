"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useReports } from "@/components/reporting/report-store";
import { DataStatusDot } from "@/components/reporting/bits";
import { useRole } from "@/components/role-context";
import { FRAMEWORKS, type Framework } from "@/lib/reporting/model";
import { ENTITY_SUGGESTIONS, ENTITY_TYPES, PERIOD_PRESETS, TEMPLATES, getTemplate } from "@/lib/reporting/templates";

/**
 * Report creation wizard (spec §6) — sequential and resumable. Framework →
 * template → entity → period → scope → evidence validation → generate. Step
 * state lives in the component; a created report lands as a Draft in the store
 * and opens in the editor.
 */

const STEPS = ["Framework", "Template", "Entity", "Period", "Scope", "Evidence", "Generate"] as const;

export function CreateWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const api = useReports();
  const { role } = useRole();
  const [step, setStep] = useState(0);
  const [framework, setFramework] = useState<Framework | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string>("Port");
  const [entityId, setEntityId] = useState("durban");
  const [entityLabel, setEntityLabel] = useState("Port of Durban");
  const [period, setPeriod] = useState(PERIOD_PRESETS[1]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  if (!open) return null;

  const templatesForFw = TEMPLATES.filter((t) => t.framework === framework);
  const tpl = templateId ? getTemplate(templateId) : null;
  const metrics = tpl ? tpl.metrics() : [];
  const included = metrics.filter((m) => !excluded.has(m.id));
  const missing = included.filter((m) => m.status === "planned");
  const demo = included.filter((m) => m.status === "demo");

  const canNext =
    (step === 0 && framework) ||
    (step === 1 && templateId) ||
    (step === 2 && entityLabel.trim()) ||
    step === 3 ||
    step === 4 ||
    step === 5 ||
    step === 6;

  const reset = () => {
    setStep(0);
    setFramework(null);
    setTemplateId(null);
    setExcluded(new Set());
    onClose();
  };

  const generate = () => {
    if (!tpl) return;
    const id = api.create({
      templateId: tpl.id,
      entityType,
      entityId,
      entityLabel,
      periodLabel: period,
      author: `${role.name} · Report Author`,
      includeMetricIds: included.map((m) => m.id),
    });
    reset();
    router.push(`/reports/${id}`);
  };

  const toggleMetric = (mid: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(mid) ? next.delete(mid) : next.add(mid);
      return next;
    });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Create report">
      <div className="absolute inset-0 bg-[rgba(4,10,20,0.55)]" onClick={reset} />
      <div className="relative flex max-h-[88vh] w-[min(720px,96vw)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-lg)]">
        {/* Stepper */}
        <header className="border-b border-border px-5 py-3.5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-[16px] font-bold text-foreground">Create report</h2>
            <button onClick={reset} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-1 overflow-x-auto">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <button
                  onClick={() => i <= step && setStep(i)}
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${i === step ? "bg-primary text-primary-foreground" : i < step ? "text-primary" : "text-muted-foreground"}`}
                >
                  <span className={`grid h-4 w-4 place-items-center rounded-full font-mono text-[9px] ${i === step ? "bg-white/20" : i < step ? "bg-primary/15" : "bg-muted"}`}>{i + 1}</span>
                  <span className="hidden sm:inline">{s}</span>
                </button>
                {i < STEPS.length - 1 && <span className="mx-0.5 h-px w-3 bg-border" aria-hidden />}
              </div>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {FRAMEWORKS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setFramework(f.id);
                    setTemplateId(null);
                  }}
                  className={`rounded-xl border p-3 text-left transition-colors ${framework === f.id ? "border-primary bg-surface-active" : "border-border hover:border-border-strong"}`}
                >
                  <p className="text-[13.5px] font-semibold text-card-foreground">{f.label}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">{f.tagline}</p>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-2.5">
              {templatesForFw.length === 0 && <p className="text-[13px] text-muted-foreground">No templates for this framework yet.</p>}
              {templatesForFw.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${templateId === t.id ? "border-primary bg-surface-active" : "border-border hover:border-border-strong"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-card-foreground">{t.name}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">{t.purpose}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">v{t.version} · {t.audience}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <label className="text-[12px] font-medium text-muted-foreground">
                Entity type
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                >
                  {ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              {ENTITY_SUGGESTIONS[entityType] && (
                <div className="flex flex-wrap gap-1.5">
                  {ENTITY_SUGGESTIONS[entityType].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setEntityId(s.id);
                        setEntityLabel(s.label);
                      }}
                      className={`rounded-full border px-2.5 py-1 text-[11.5px] ${entityLabel === s.label ? "border-primary bg-surface-active text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <label className="text-[12px] font-medium text-muted-foreground">
                Reporting entity
                <input
                  value={entityLabel}
                  onChange={(e) => {
                    setEntityLabel(e.target.value);
                    setEntityId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                  }}
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-[13px] ${period === p ? "border-primary bg-surface-active text-primary" : "border-border text-card-foreground hover:border-border-strong"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-2">
              <p className="text-[12.5px] text-muted-foreground">This template includes these sections. Metrics are chosen on the next step.</p>
              {tpl?.sections.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <span className="grid h-5 w-5 place-items-center rounded bg-muted font-mono text-[9px] text-muted-foreground">{i + 1}</span>
                  <span className="text-[12.5px] text-card-foreground">{s.title.replaceAll("{ENTITY}", entityLabel).replaceAll("{PERIOD}", period)}</span>
                  <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">{s.type}</span>
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border bg-background p-2.5">
                  <p className="font-heading text-[20px] font-bold text-foreground">{included.length}</p>
                  <p className="text-[10.5px] text-muted-foreground">included metrics</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-2.5">
                  <p className="font-heading text-[20px] font-bold text-warning">{demo.length}</p>
                  <p className="text-[10.5px] text-muted-foreground">demo / illustrative</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-2.5">
                  <p className="font-heading text-[20px] font-bold text-muted-foreground">{missing.length}</p>
                  <p className="text-[10.5px] text-muted-foreground">planned (no data)</p>
                </div>
              </div>
              {metrics.length === 0 && <p className="text-[12.5px] text-muted-foreground">Custom template — add metrics in the editor after generating.</p>}
              <div className="flex flex-col gap-1.5">
                {metrics.map((m) => (
                  <label key={m.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2">
                    <input type="checkbox" checked={!excluded.has(m.id)} onChange={() => toggleMetric(m.id)} className="accent-[var(--primary)]" />
                    <span className="min-w-0 flex-1 text-[12.5px] text-card-foreground">{m.name}</span>
                    <span className="font-mono text-[12px] tabular-nums text-foreground">{m.value}{m.unit ? ` ${m.unit}` : ""}</span>
                    <DataStatusDot status={m.status} />
                  </label>
                ))}
              </div>
              {(demo.length > 0 || missing.length > 0) && (
                <p className="rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-2 text-[11.5px] text-warning">
                  This scope contains {demo.length ? `${demo.length} demo` : ""}{demo.length && missing.length ? " and " : ""}{missing.length ? `${missing.length} planned` : ""} metric(s). They&apos;ll be clearly
                  labelled and blocked from official submission until real evidence lands.
                </p>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Ready to generate</p>
                <p className="mt-1 font-heading text-[16px] font-bold text-foreground">{entityLabel} — {tpl?.name}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                  <span>Framework: <b className="text-foreground">{FRAMEWORKS.find((f) => f.id === framework)?.label}</b></span>
                  <span>Period: <b className="text-foreground">{period}</b></span>
                  <span>Sections: <b className="text-foreground">{tpl?.sections.length}</b></span>
                  <span>Metrics: <b className="text-foreground">{included.length}</b></span>
                </div>
              </div>
              <p className="text-[12.5px] text-muted-foreground">
                Generating creates a <b className="text-foreground">Draft</b> with the cover, executive summary, KPI sections, evidence references and
                recommendations pre-populated. You then edit, validate and route it for review and approval.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-border px-5 py-3">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="rounded-lg border border-border px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-muted">
              Back
            </button>
          )}
          <span className="ml-auto" />
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext}
              className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button onClick={generate} className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground">
              Generate draft
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

import type { Confidentiality, Framework, Report, ReportSection } from "./model";
import { getTemplate } from "./templates";

/**
 * Instantiate a Report from a template (shared by the seed and the creation
 * wizard). Substitutes {ENTITY}/{PERIOD} tokens, attaches the template's Gold
 * metrics to the KPI/chart sections, and computes per-section completion.
 */

export interface CreateInput {
  templateId: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  periodLabel: string;
  author: string;
  reviewer?: string | null;
  approver?: string | null;
  confidentiality?: Confidentiality;
  /** Metric ids the user chose to include; defaults to all template metrics. */
  includeMetricIds?: string[];
}

export function instantiateReport(input: CreateInput, id: string, now: string): Report {
  const tpl = getTemplate(input.templateId)!;
  const framework = tpl.framework as Framework;
  const allMetrics = tpl.metrics();
  const metrics = input.includeMetricIds ? allMetrics.filter((m) => input.includeMetricIds!.includes(m.id)) : allMetrics;
  const chartMetricIds = metrics.filter((m) => m.series && m.series.length > 1).map((m) => m.id);

  const sections: ReportSection[] = tpl.sections.map((b, i) => {
    const content = (b.content ?? "").replaceAll("{ENTITY}", input.entityLabel).replaceAll("{PERIOD}", input.periodLabel);
    const metricRefs = b.type === "kpi" ? metrics.map((m) => m.id) : b.type === "chart" ? chartMetricIds : [];
    const complete = b.type === "kpi" || b.type === "chart" ? metricRefs.length > 0 : b.type === "cover" ? true : content.trim().length > 20;
    return {
      id: `s${i}-${b.type}`,
      type: b.type,
      title: b.title.replaceAll("{ENTITY}", input.entityLabel).replaceAll("{PERIOD}", input.periodLabel),
      sequence: i,
      content,
      metricRefs,
      owner: input.author,
      locked: false,
      complete,
    };
  });

  return {
    id,
    title: `${input.entityLabel} — ${tpl.name}`,
    framework,
    templateId: tpl.id,
    templateName: tpl.name,
    templateVersion: tpl.version,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    periodLabel: input.periodLabel,
    status: "draft",
    author: input.author,
    reviewer: input.reviewer ?? null,
    approver: input.approver ?? null,
    confidentiality: input.confidentiality ?? "internal",
    dueDate: "2026-07-31",
    sections,
    metrics,
    versions: [],
    approvals: [],
    activity: [{ at: now, actor: input.author, kind: "created", text: `Created from “${tpl.name}” (v${tpl.version}).` }],
    aiLog: [],
    currentVersion: 0,
    createdAt: now,
    updatedAt: now,
    locked: false,
  };
}

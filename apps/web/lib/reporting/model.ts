import type { EvidenceRecord } from "@/lib/evidence/types";

/**
 * Reporting Centre data model (XDi Reporting spec §7, §12, §18, §19).
 * Client-safe: no server imports, so the workspace and store can share these
 * shapes. Reports are built from the same ontology objects, Gold metrics and
 * evidence records as the rest of the platform — a report is a controlled view
 * over that intelligence, never a separate document store.
 */

// ── Frameworks (§4) ─────────────────────────────────────
export type Framework = "aprm" | "afcfta" | "au" | "dfi" | "afreximbank" | "port" | "government" | "custom";

export const FRAMEWORKS: Array<{ id: Framework; label: string; tagline: string }> = [
  { id: "aprm", label: "APRM", tagline: "Generate traceable governance and development evidence for peer-review reporting." },
  { id: "afcfta", label: "AfCFTA", tagline: "Track implementation, trade integration, corridor performance, and rules-of-origin outcomes." },
  { id: "au", label: "African Union", tagline: "Measure continental integration, development progress, and Agenda 2063 delivery." },
  { id: "dfi", label: "DFI", tagline: "Track project performance, portfolio risk, and measurable development impact." },
  { id: "afreximbank", label: "Afreximbank", tagline: "Measure how finance, trade corridors, payments, and industrialisation unlock African trade." },
  { id: "port", label: "Port Authority", tagline: "Turn operational, commercial, and financial performance into accountable port reporting." },
  { id: "government", label: "Government & Policy", tagline: "Convert trade, infrastructure, and market data into policy-ready evidence." },
  { id: "custom", label: "Custom", tagline: "Build institution-specific reports from approved objects, metrics, and evidence." },
];

export const FRAMEWORK_LABEL: Record<Framework, string> = Object.fromEntries(FRAMEWORKS.map((f) => [f.id, f.label])) as Record<Framework, string>;

// ── Lifecycle (§7) ──────────────────────────────────────
export type ReportStatus =
  | "draft"
  | "evidence_required"
  | "ready_for_review"
  | "in_review"
  | "returned"
  | "submitted_approval"
  | "approved"
  | "published"
  | "superseded"
  | "archived";

export const STATUS_META: Record<ReportStatus, { label: string; tone: "neutral" | "warn" | "info" | "review" | "ok" | "published" | "muted"; short: string }> = {
  draft: { label: "Draft", tone: "neutral", short: "Draft" },
  evidence_required: { label: "Evidence Required", tone: "warn", short: "Evidence" },
  ready_for_review: { label: "Ready for Review", tone: "info", short: "Ready" },
  in_review: { label: "In Review", tone: "review", short: "In review" },
  returned: { label: "Returned for Changes", tone: "warn", short: "Returned" },
  submitted_approval: { label: "Submitted for Approval", tone: "review", short: "Approval" },
  approved: { label: "Approved", tone: "ok", short: "Approved" },
  published: { label: "Published", tone: "published", short: "Published" },
  superseded: { label: "Superseded", tone: "muted", short: "Superseded" },
  archived: { label: "Archived", tone: "muted", short: "Archived" },
};

/** CSS var per tone, for badges / rails. */
export const TONE_VAR: Record<string, string> = {
  neutral: "var(--muted-foreground)",
  warn: "var(--warning)",
  info: "var(--info)",
  review: "var(--simulation)",
  ok: "var(--success)",
  published: "var(--primary)",
  muted: "var(--muted-foreground)",
};

export type Confidentiality = "public" | "internal" | "restricted" | "confidential";

export interface ReportMetric {
  id: string;
  name: string;
  value: string;
  unit?: string;
  status: "live" | "demo" | "planned";
  confidence: number;
  evidence: EvidenceRecord;
  /** Optional sparkline / series for a trend visual. */
  series?: number[];
}

export interface ReportSection {
  id: string;
  type: "cover" | "summary" | "kpi" | "narrative" | "chart" | "exceptions" | "recommendations" | "annexure";
  title: string;
  sequence: number;
  content: string;
  /** Metric ids surfaced in this section. */
  metricRefs: string[];
  owner: string;
  locked: boolean;
  /** True once required content + evidence are present. */
  complete: boolean;
  /** Marks AI-drafted content pending human review (§9). */
  aiDrafted?: boolean;
}

export interface ReportVersion {
  number: number;
  at: string;
  by: string;
  changeSummary: string;
  evidenceSnapshotId: string;
  validationStatus: "passed" | "warnings" | "failed";
}

export interface ReportApproval {
  version: number;
  actor: string;
  action: "submit_review" | "return" | "submit_approval" | "approve" | "reject" | "publish";
  comment?: string;
  at: string;
}

export type ActivityKind = "created" | "comment" | "status" | "version" | "evidence" | "ai" | "distribution";

export interface ReportActivity {
  at: string;
  actor: string;
  kind: ActivityKind;
  text: string;
}

export interface AiLogEntry {
  at: string;
  advisor: string;
  prompt: string;
  status: "live" | "demo" | "down";
  outputChars: number;
}

export interface Report {
  id: string;
  title: string;
  framework: Framework;
  templateId: string;
  templateName: string;
  templateVersion: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  periodLabel: string;
  status: ReportStatus;
  author: string;
  reviewer: string | null;
  approver: string | null;
  confidentiality: Confidentiality;
  dueDate: string;
  sections: ReportSection[];
  metrics: ReportMetric[];
  versions: ReportVersion[];
  approvals: ReportApproval[];
  activity: ReportActivity[];
  aiLog: AiLogEntry[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  /** True once approved — content becomes immutable (§18). */
  locked: boolean;
  scheduled?: boolean;
}

// ── Validation (§21) ────────────────────────────────────
export interface ValidationCheck {
  rule: string;
  ok: boolean;
  detail: string;
}

export function validateReport(r: Report): ValidationCheck[] {
  const requiredSections = r.sections.filter((s) => s.type !== "annexure");
  const filled = requiredSections.filter((s) => s.content.trim().length > 20 || s.metricRefs.length > 0);
  const demoUnlabelled = r.metrics.some((m) => m.status === "demo") && r.confidentiality === "public";
  const planned = r.metrics.filter((m) => m.status === "planned");
  const lowConf = r.metrics.filter((m) => m.confidence < 0.4);
  return [
    { rule: "Required sections completed", ok: filled.length === requiredSections.length, detail: `${filled.length}/${requiredSections.length} sections have content or metrics` },
    { rule: "Required metrics present", ok: r.metrics.length > 0, detail: `${r.metrics.length} metrics attached` },
    { rule: "Every metric carries evidence", ok: r.metrics.every((m) => m.evidence.lineage.length > 0), detail: "Bronze→Silver→Gold lineage on each metric" },
    { rule: "No Planned metric presented as real", ok: planned.length === 0, detail: planned.length ? `${planned.length} planned metric(s) — label or exclude` : "none" },
    { rule: "No unlabelled Demo data in a public report", ok: !demoUnlabelled, detail: demoUnlabelled ? "Public report contains Demo data" : "ok" },
    { rule: "Low-confidence evidence flagged", ok: lowConf.length === 0, detail: lowConf.length ? `${lowConf.length} metric(s) below 0.40 confidence` : "none" },
    { rule: "Reviewer assigned", ok: !!r.reviewer, detail: r.reviewer ?? "unassigned" },
    { rule: "Approver authorised (maker-checker)", ok: !!r.approver && r.approver !== r.author, detail: r.approver ? (r.approver === r.author ? "approver must differ from author" : r.approver) : "unassigned" },
    { rule: "Confidentiality label applied", ok: !!r.confidentiality, detail: r.confidentiality },
  ];
}

export function validationStatus(checks: ValidationCheck[]): "passed" | "warnings" | "failed" {
  const failed = checks.filter((c) => !c.ok).length;
  return failed === 0 ? "passed" : failed <= 2 ? "warnings" : "failed";
}

export function completion(r: Report): number {
  if (r.sections.length === 0) return 0;
  return Math.round((r.sections.filter((s) => s.complete).length / r.sections.length) * 100);
}

/** Groups used by the home summary cards (§5.3). */
export function summaryGroup(r: Report, today = "2026-07-13"): string | null {
  if (r.status === "draft") return "draft";
  if (r.status === "evidence_required") return "evidence";
  if (r.status === "ready_for_review" || r.status === "in_review") return "review";
  if (r.status === "submitted_approval") return "approval";
  if (r.status === "approved") return "approved";
  if (r.status === "published") return "published";
  return null;
}

export function isOverdue(r: Report, today = "2026-07-13"): boolean {
  return r.dueDate < today && r.status !== "published" && r.status !== "approved" && r.status !== "archived";
}

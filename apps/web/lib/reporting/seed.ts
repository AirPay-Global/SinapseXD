import { instantiateReport, type CreateInput } from "./instantiate";
import type { Report, ReportStatus } from "./model";

/**
 * Seed reports for the Reporting Centre — a spread across frameworks and every
 * lifecycle stage so the home queues and summary cards read as a living
 * workspace. Deterministic; user actions overlay this via the store.
 */

export const SEED_VERSION = "2026-07-13.1";

const NOW = "2026-07-01T09:00:00Z";

interface SeedSpec extends CreateInput {
  id: string;
  status: ReportStatus;
  dueDate: string;
  scheduled?: boolean;
  extraActivity?: Report["activity"];
  versions?: Report["versions"];
  approvals?: Report["approvals"];
}

const SPECS: SeedSpec[] = [
  {
    id: "rep-durban-port-exec-jul",
    templateId: "port-monthly-exec",
    entityType: "Port",
    entityId: "durban",
    entityLabel: "Port of Durban",
    periodLabel: "2026-07 (Monthly)",
    author: "N. Dlamini · Reporting Analyst",
    reviewer: "T. Naidoo · Commercial Director",
    approver: "Port CEO",
    confidentiality: "internal",
    status: "in_review",
    dueDate: "2026-07-18",
    extraActivity: [
      { at: "2026-07-08T10:00:00Z", actor: "N. Dlamini", kind: "status", text: "Marked ready for review." },
      { at: "2026-07-09T08:30:00Z", actor: "T. Naidoo", kind: "status", text: "Started review." },
    ],
  },
  {
    id: "rep-zaf-aprm-q2",
    templateId: "aprm-quarterly",
    entityType: "Country",
    entityId: "zaf",
    entityLabel: "South Africa",
    periodLabel: "2026-Q2 (Quarterly)",
    author: "Secretariat · Evidence Officer",
    reviewer: "APRM Panel",
    approver: null,
    confidentiality: "restricted",
    status: "evidence_required",
    dueDate: "2026-07-20",
    extraActivity: [{ at: "2026-07-05T12:00:00Z", actor: "Sinapse", kind: "evidence", text: "3 indicators are missing verified evidence." }],
  },
  {
    id: "rep-mombasa-dfi-q2",
    templateId: "dfi-project-monitoring",
    entityType: "Project",
    entityId: "mombasa-deepening",
    entityLabel: "Mombasa berth-deepening",
    periodLabel: "2026-Q2 (Quarterly)",
    author: "L. Okafor · Investment Officer",
    reviewer: "Portfolio Manager",
    approver: "DFI Credit Committee",
    confidentiality: "confidential",
    status: "approved",
    dueDate: "2026-06-30",
    versions: [{ number: 1, at: "2026-06-28T14:00:00Z", by: "L. Okafor", changeSummary: "Initial approved version.", evidenceSnapshotId: "snap-8f21c4", validationStatus: "passed" }],
    approvals: [
      { version: 1, actor: "Portfolio Manager", action: "submit_approval", at: "2026-06-26T09:00:00Z" },
      { version: 1, actor: "DFI Credit Committee", action: "approve", comment: "Covenant verified; tranche released.", at: "2026-06-28T14:00:00Z" },
    ],
    extraActivity: [{ at: "2026-06-28T14:00:00Z", actor: "DFI Credit Committee", kind: "status", text: "Approved — version 1 sealed with evidence snapshot snap-8f21c4." }],
  },
  {
    id: "rep-nsc-afcfta-q2",
    templateId: "afcfta-corridor",
    entityType: "Corridor",
    entityId: "durban-lusaka",
    entityLabel: "Durban–Lusaka (North-South)",
    periodLabel: "2026-Q2 (Quarterly)",
    author: "AfCFTA · Corridor Analyst",
    reviewer: "Digital Trade Unit",
    approver: "AfCFTA Secretariat",
    confidentiality: "internal",
    status: "submitted_approval",
    dueDate: "2026-07-15",
    extraActivity: [{ at: "2026-07-10T11:00:00Z", actor: "Digital Trade Unit", kind: "status", text: "Review complete — submitted for approval." }],
  },
  {
    id: "rep-zaf-gov-h1",
    templateId: "government-trade",
    entityType: "Country",
    entityId: "zaf",
    entityLabel: "South Africa",
    periodLabel: "2026-H1 (Half-year)",
    author: "Policy Director",
    reviewer: null,
    approver: null,
    confidentiality: "internal",
    status: "draft",
    dueDate: "2026-08-15",
  },
  {
    id: "rep-au-agenda2063-2026",
    templateId: "au-agenda2063",
    entityType: "Region / REC",
    entityId: "africa",
    entityLabel: "Continental (55 states)",
    periodLabel: "2026 (Annual)",
    author: "AU · M&E Officer",
    reviewer: "AU Commission",
    approver: "AU Commission",
    confidentiality: "public",
    status: "published",
    dueDate: "2026-06-01",
    scheduled: true,
    versions: [{ number: 1, at: "2026-05-28T10:00:00Z", by: "AU · M&E Officer", changeSummary: "Annual report, approved & published.", evidenceSnapshotId: "snap-2063a1", validationStatus: "passed" }],
    approvals: [{ version: 1, actor: "AU Commission", action: "publish", at: "2026-06-01T09:00:00Z" }],
    extraActivity: [{ at: "2026-06-01T09:00:00Z", actor: "AU Commission", kind: "distribution", text: "Published to the continental portal." }],
  },
];

export const SEED_REPORTS: Report[] = SPECS.map((spec) => {
  const r = instantiateReport(spec, spec.id, NOW);
  r.status = spec.status;
  r.dueDate = spec.dueDate;
  r.scheduled = spec.scheduled;
  if (spec.versions) {
    r.versions = spec.versions;
    r.currentVersion = spec.versions[spec.versions.length - 1].number;
  }
  if (spec.approvals) r.approvals = spec.approvals;
  if (spec.extraActivity) r.activity = [...r.activity, ...spec.extraActivity];
  if (spec.status === "approved" || spec.status === "published") r.locked = true;
  return r;
});

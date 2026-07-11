import type { EvidenceRecord } from "@/lib/evidence/types";

/**
 * Decision work-item model (UI Evolution spec, Priority 1 + 10). A decision is
 * not a card to read — it's an operational work item that moves through the
 * lifecycle: Insight → Recommendation → Approval → Workflow → Task →
 * Execution → Monitoring → Outcome. Client-safe (no server deps).
 */

export const LIFECYCLE_STAGES = [
  "insight",
  "recommendation",
  "approval",
  "workflow",
  "task",
  "execution",
  "monitoring",
  "outcome",
] as const;
export type DecisionStage = (typeof LIFECYCLE_STAGES)[number];

export const STAGE_LABEL: Record<DecisionStage, string> = {
  insight: "Insight",
  recommendation: "Recommendation",
  approval: "Approval",
  workflow: "Workflow",
  task: "Tasks",
  execution: "Execution",
  monitoring: "Monitoring",
  outcome: "Outcome",
};

/** What the user has done with the recommendation. */
export type DecisionState =
  | "open"
  | "accepted"
  | "rejected"
  | "modified"
  | "delegated"
  | "scheduled"
  | "investigating";

export const STATE_LABEL: Record<DecisionState, string> = {
  open: "Awaiting decision",
  accepted: "Accepted",
  rejected: "Rejected",
  modified: "Modified",
  delegated: "Delegated",
  scheduled: "Scheduled",
  investigating: "Under investigation",
};

export type ActivityKind =
  | "created"
  | "comment"
  | "action"
  | "approval"
  | "assignment"
  | "task"
  | "version";

export interface DecisionActivity {
  at: string;
  actor: string;
  kind: ActivityKind;
  text: string;
}

export interface RelatedObject {
  label: string;
  href?: string;
}

export interface WorkflowTask {
  id: string;
  title: string;
  owner: string;
  done: boolean;
}

export interface DecisionItem {
  id: string;
  sev: "hi" | "md" | "gd";
  /** Which command centre raised it, e.g. "Port Authority". */
  stakeholder: string;
  /** Business problem — the card title. */
  problem: string;
  body: string;
  /** Financial / strategic value at risk. */
  valueAtRisk: { label: string; amount: string };
  /** 0–1, mirrors the evidence confidence. */
  confidence: number;
  recommendation: string;
  expectedOutcome: string;
  owner: string;
  dueDate: string;
  stage: DecisionStage;
  state: DecisionState;
  relatedObjects: RelatedObject[];
  watchers: string[];
  tasks: WorkflowTask[];
  evidence: EvidenceRecord;
  activity: DecisionActivity[];
  /** Bumped by Modify — every change is versioned. */
  version: number;
}

/** The mutable slice persisted to localStorage and merged over the seed. */
export interface DecisionOverlay {
  state?: DecisionState;
  stage?: DecisionStage;
  owner?: string;
  dueDate?: string;
  recommendation?: string;
  watchers?: string[];
  tasks?: WorkflowTask[];
  activity?: DecisionActivity[];
  version?: number;
}

export const SEV_LABEL: Record<DecisionItem["sev"], string> = {
  hi: "Critical",
  md: "Attention",
  gd: "Opportunity",
};

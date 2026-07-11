/**
 * Evidence model (Design Bible §8, v2 Principles #4/#7). Every value shown in
 * the Decision OS can carry one of these so a user can drill from a KPI to the
 * raw, checksummed source it came from. Client-safe (no server deps).
 */

export interface LineageStage {
  zone: "bronze" | "silver" | "gold";
  title: string;
  /** Table or storage-path locator, shown mono. */
  locator: string;
  detail: string;
  sources: string[];
}

/** A named data-contract check applied on the Silver→Gold path. */
export interface ValidationRule {
  rule: string;
  passed: boolean;
}

/** One refresh of the underlying mart — "commit history" for the value. */
export interface RefreshEvent {
  at: string;
  outcome: "ok" | "late" | "failed";
  note?: string;
}

export interface EvidenceRecord {
  /** Human name of the value, e.g. "Congestion Score". */
  metric: string;
  value: string;
  /** Ontology object the value belongs to, e.g. "object · port:durban". */
  objectRef: string;
  asOf: string;
  /** 0–1. Drives the confidence bar + band label. */
  confidence: number;
  lineage: LineageStage[];
  recommendation?: string;
  /** live | demo | planned — provenance honesty carried into the drawer. */
  status?: "live" | "demo" | "planned";
  /** 0–1 data-quality score (completeness, timeliness, validity). */
  qualityScore?: number;
  /** Data-contract checks — "CI checks" for the value. */
  validations?: ValidationRule[];
  /** Recent refresh runs, newest first. */
  refreshHistory?: RefreshEvent[];
  /** Accountable data steward, e.g. "Pipeline · ais_ingestor". */
  steward?: string;
}

export function confidenceBand(c: number): "high" | "medium" | "low" {
  return c >= 0.7 ? "high" : c >= 0.4 ? "medium" : "low";
}

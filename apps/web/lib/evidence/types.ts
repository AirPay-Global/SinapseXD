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
}

export function confidenceBand(c: number): "high" | "medium" | "low" {
  return c >= 0.7 ? "high" : c >= 0.4 ? "medium" : "low";
}

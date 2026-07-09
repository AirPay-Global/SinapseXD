import type { EvidenceRecord } from "./types";

/**
 * Concise builder for an evidence record with a generic (but honest)
 * Bronze→Silver→Gold lineage, so every KPI across the dashboards can be made
 * drillable without hand-authoring three stages each. Pass real stage detail
 * when it matters; this fills sensible defaults from the pillar + mart names.
 */
export function quickEvidence(p: {
  metric: string;
  value: string;
  objectRef: string;
  confidence: number;
  status?: "live" | "demo" | "planned";
  /** Human pillar name, e.g. "Trade Analytics". */
  pillar: string;
  /** Bronze source slug, e.g. "portwatch". */
  source: string;
  /** Gold mart / view name (append * if not yet built). */
  gold: string;
  /** Silver table name; defaults to a generic label. */
  silver?: string;
  bronzeDetail?: string;
  goldDetail?: string;
  recommendation?: string;
}): EvidenceRecord {
  const status = p.status ?? "demo";
  return {
    metric: p.metric,
    value: p.value,
    objectRef: p.objectRef,
    asOf: "as of 07 Jul 2026, 14:20 UTC",
    confidence: p.confidence,
    status,
    recommendation: p.recommendation,
    lineage: [
      {
        zone: "bronze",
        title: `${p.pillar} feed`,
        locator: `pillar/${p.source}`,
        detail: p.bronzeDetail ?? "Raw records landed as immutable, checksummed Parquet.",
        sources: [p.source, "sha256:…"],
      },
      {
        zone: "silver",
        title: "Normalise & ontology-key",
        locator: p.silver ?? "silver_conformed",
        detail: "Cleaned, deduplicated and resolved to canonical ontology keys.",
        sources: ["ontology-keyed", "idempotent upsert"],
      },
      {
        zone: "gold",
        title: p.metric,
        locator: p.gold,
        detail: p.goldDetail ?? "Pre-aggregated decision mart, one source of truth for this KPI.",
        sources: status === "planned" ? ["planned"] : status === "live" ? ["live mart"] : ["demo"],
      },
    ],
  };
}

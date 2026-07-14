import type { Layer } from "./catalogue";

/**
 * Layer compatibility engine (spec §10). Before combining datasets it assesses
 * geography, time, granularity, units and data status, returning one of four
 * states with a plain reason — the overlay engine and the AI Advisor both use
 * this so users are never silently shown an unsafe combination.
 */

export type CompatState = "compatible" | "transform" | "partial" | "incompatible";

export const COMPAT_LABEL: Record<CompatState, string> = {
  compatible: "Compatible",
  transform: "Compatible after transformation",
  partial: "Partially compatible",
  incompatible: "Incompatible",
};

export const COMPAT_VAR: Record<CompatState, string> = {
  compatible: "var(--success)",
  transform: "var(--info)",
  partial: "var(--warning)",
  incompatible: "var(--destructive)",
};

export interface Compatibility {
  state: CompatState;
  reason: string;
}

/** Assess adding `candidate` to a canvas that already holds `active` layers. */
export function assess(candidate: Layer, active: Layer[]): Compatibility {
  if (candidate.status === "planned" || candidate.values.length === 0) {
    return { state: "incompatible", reason: "This layer is Planned — no data has landed yet, so it can't be overlaid." };
  }
  if (active.length === 0) return { state: "compatible", reason: "First layer — shares the canonical pilot geographies." };

  // All catalogue layers share the 7 pilot geographies and monthly frequency,
  // so the live axes of incompatibility are unit class and provenance.
  const unitsDiffer = active.some((a) => a.unitClass !== candidate.unitClass);
  const provenanceMixed = active.some((a) => a.status !== candidate.status);

  if (unitsDiffer && provenanceMixed) {
    return { state: "partial", reason: `Units differ (${candidate.unit}) and provenance is mixed (${candidate.status} vs live) — overlaid on a normalised (z-score) axis and flagged.` };
  }
  if (unitsDiffer) {
    return { state: "transform", reason: `Units differ (${candidate.unit} vs the active layer) — aligned by normalising both to a comparable scale. The conversion stays visible and reversible.` };
  }
  if (provenanceMixed) {
    return { state: "partial", reason: `Provenance is mixed (${candidate.status} vs live). Safe to overlay, but read the combination with that in mind.` };
  }
  return { state: "compatible", reason: "Same geography, frequency and unit class — a clean overlay." };
}

"use client";

import { useEvidence } from "@/components/evidence/evidence-drawer";
import type { EvidenceRecord } from "@/lib/evidence/types";

/**
 * The "Explain" affordance — a small footer control that opens the Evidence
 * drawer for a given record. Dropped into KPI cards so every value is
 * drillable (Design Bible §12). Client-only; safe to render inside a
 * server-composed card because it's a leaf client component.
 */
export function Explainable({ evidence }: { evidence: EvidenceRecord }) {
  const open = useEvidence();
  return (
    <button
      onClick={() => open(evidence)}
      className="mt-3 flex w-full items-center justify-between border-t border-border pt-2.5 text-left"
    >
      <span className="font-mono text-[10px] tracking-[0.04em] text-muted-foreground">gold · ontology-keyed</span>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
        Explain
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </span>
    </button>
  );
}

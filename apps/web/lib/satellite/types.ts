/**
 * Satellite Intelligence data model (XDi Satellite Intelligence spec).
 * Client-safe: no server imports, so the workspace, canvas and berth store
 * share these shapes. The guiding rule of the whole feature (spec §14) is
 * honesty about provenance — every object carries how it was arrived at:
 * directly observed, machine-inferred, model-predicted, analyst-reviewed,
 * port-verified, demo, or planned. Nothing is presented as confirmed fact
 * that a model merely guessed.
 */
import type { EvidenceRecord } from "@/lib/evidence/types";

// ── Provenance (spec §14 — the labels every screen must apply) ──
export type Provenance =
  | "observed" // directly seen in AIS or imagery
  | "inferred" // machine-derived from a model (clustering, occupancy)
  | "predicted" // forward-looking model output (likely berth)
  | "analyst_reviewed" // a human has checked it
  | "port_verified" // the responsible port authority confirmed it
  | "demo" // illustrative, no live pipeline behind it
  | "planned"; // capability not built yet

export const PROVENANCE_META: Record<Provenance, { label: string; tone: "observed" | "inferred" | "predicted" | "reviewed" | "verified" | "demo" | "planned" }> = {
  observed: { label: "Observed", tone: "observed" },
  inferred: { label: "Inferred", tone: "inferred" },
  predicted: { label: "Predicted", tone: "predicted" },
  analyst_reviewed: { label: "Analyst reviewed", tone: "reviewed" },
  port_verified: { label: "Port verified", tone: "verified" },
  demo: { label: "Demo", tone: "demo" },
  planned: { label: "Planned", tone: "planned" },
};

// ── AIS vs imagery vs fusion (spec §3 — never conflate) ──
export type IntelSource = "ais" | "imagery" | "fusion";
export const INTEL_SOURCE_LABEL: Record<IntelSource, string> = {
  ais: "AIS-derived",
  imagery: "Imagery-derived",
  fusion: "Fused AIS + imagery",
};

// ── Berth lifecycle (spec §4.2) ──
export type BerthState =
  | "candidate"
  | "machine_inferred"
  | "analyst_reviewed"
  | "port_verified"
  | "published"
  | "rejected"
  | "superseded";

export const BERTH_STATE_META: Record<BerthState, { label: string; provenance: Provenance; tone: string }> = {
  candidate: { label: "Candidate", provenance: "inferred", tone: "text-muted-foreground" },
  machine_inferred: { label: "Machine inferred", provenance: "inferred", tone: "text-warning" },
  analyst_reviewed: { label: "Analyst reviewed", provenance: "analyst_reviewed", tone: "text-info" },
  port_verified: { label: "Port verified", provenance: "port_verified", tone: "text-success" },
  published: { label: "Published", provenance: "port_verified", tone: "text-success" },
  rejected: { label: "Rejected", provenance: "analyst_reviewed", tone: "text-destructive" },
  superseded: { label: "Superseded", provenance: "analyst_reviewed", tone: "text-muted-foreground" },
};

/** Confidence factors (spec §4.2) — the transparent inputs to a berth's score. */
export interface ConfidenceFactors {
  vesselsObserved: number;
  calls: number;
  avgDurationHrs: number;
  speedConsistency: number; // 0–1
  headingConsistency: number; // 0–1
  classConsistency: number; // 0–1
  nearInfrastructure: boolean;
  imageryConfirmed: boolean;
  portConfirmed: boolean;
  freshnessDays: number;
}

/** A local-space polygon in the canvas's 0–100 coordinate frame. */
export type Poly = Array<[number, number]>;

export interface Berth {
  id: string;
  portId: string;
  name: string;
  terminal: string;
  state: BerthState;
  source: IntelSource;
  /** Canvas-space centroid (0–100) for the demo geo-canvas. */
  x: number;
  y: number;
  orientationDeg: number;
  polygon: Poly;
  lengthM: number;
  estDepthM: number;
  vesselClasses: string[];
  commodity: string;
  /** 0–1 rolled-up confidence. */
  confidence: number;
  factors: ConfidenceFactors;
  utilisationPct: number;
  avgServiceHrs: number;
  occupied: boolean;
  currentVessel?: string;
  lastCall: string;
  evidence: EvidenceRecord;
}

export interface VesselTrack {
  mmsi: string;
  name: string;
  vesselClass: string;
  source: "terrestrial" | "satellite";
  signalConfidence: number; // 0–1
  lastSignal: string;
  speedKn: number;
  headingDeg: number;
  navStatus: string;
  destination: string;
  eta: string;
  /** Ordered canvas-space points (0–100), oldest → newest. */
  track: Poly;
}

export interface OccupancySlot {
  berthId: string;
  berthName: string;
  /** Segments across a 14-day window; each is [startDay, endDay, vessel]. */
  segments: Array<{ start: number; end: number; vessel: string; vesselClass: string }>;
}

/** Left-panel layer toggles (spec §5). */
export interface LayerDef {
  id: string;
  label: string;
  group: "ais" | "imagery" | "geometry" | "environment" | "confidence";
  defaultOn: boolean;
  provenance: Provenance;
}

export const LAYERS: LayerDef[] = [
  { id: "vessel_tracks", label: "Vessel tracks", group: "ais", defaultOn: true, provenance: "observed" },
  { id: "vessel_positions", label: "Current positions", group: "ais", defaultOn: true, provenance: "observed" },
  { id: "anchorage", label: "Anchorage areas", group: "geometry", defaultOn: true, provenance: "observed" },
  { id: "port_boundary", label: "Port boundary", group: "geometry", defaultOn: true, provenance: "observed" },
  { id: "terminal_boundary", label: "Terminal boundaries", group: "geometry", defaultOn: true, provenance: "observed" },
  { id: "confirmed_berths", label: "Confirmed berths", group: "geometry", defaultOn: true, provenance: "port_verified" },
  { id: "candidate_berths", label: "Candidate berths", group: "confidence", defaultOn: true, provenance: "inferred" },
  { id: "optical", label: "Optical imagery", group: "imagery", defaultOn: false, provenance: "planned" },
  { id: "radar", label: "Radar imagery (SAR)", group: "imagery", defaultOn: false, provenance: "planned" },
  { id: "weather", label: "Weather & sea state", group: "environment", defaultOn: false, provenance: "demo" },
  { id: "confidence_heat", label: "Confidence overlay", group: "confidence", defaultOn: false, provenance: "inferred" },
];

/** The structured AI-advisor response contract (spec §6). */
export interface SatelliteAnalysis {
  visible: string;
  inferred: string;
  changed: string;
  matters: string;
  alternatives: string;
  limitations: string[];
  confidence: "High" | "Medium" | "Low";
  nextStep: string;
  live: boolean;
}

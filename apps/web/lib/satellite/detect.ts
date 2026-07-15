/**
 * Berth-discovery scoring (spec §4.2). Turns the transparent confidence
 * factors into a single 0–1 score. Deliberately a plain, explainable weighted
 * sum — not a black box — because the spec (§14) forbids promoting a candidate
 * berth to confirmed without human review, and every factor must be inspectable
 * in the evidence drawer. The real detector (stationary-event clustering with
 * heading-variation filtering over historical AIS) lands with the Silver
 * pipeline; this scores the same factors that detector will emit.
 */
import type { ConfidenceFactors } from "./types";

export function scoreBerth(f: ConfidenceFactors): number {
  // Weights sum to 1.0. Multi-vessel evidence and heading consistency dominate
  // — a single vessel sitting still is congestion, not a berth (spec §4.2 #6).
  const vesselEvidence = Math.min(1, f.vesselsObserved / 8); // saturates at 8 vessels
  const callVolume = Math.min(1, f.calls / 40);
  const duration = Math.min(1, f.avgDurationHrs / 36);
  const score =
    0.24 * vesselEvidence +
    0.12 * callVolume +
    0.1 * duration +
    0.1 * f.speedConsistency +
    0.18 * f.headingConsistency +
    0.08 * f.classConsistency +
    0.06 * (f.nearInfrastructure ? 1 : 0) +
    0.06 * (f.imageryConfirmed ? 1 : 0) +
    0.04 * (f.portConfirmed ? 1 : 0) +
    0.02 * Math.max(0, 1 - f.freshnessDays / 7);
  return Math.round(Math.min(0.99, score) * 100) / 100;
}

/** Human-readable factor list for the berth profile / evidence drawer. */
export function factorRows(f: ConfidenceFactors): Array<{ label: string; value: string; strong: boolean }> {
  return [
    { label: "Vessels observed", value: String(f.vesselsObserved), strong: f.vesselsObserved >= 3 },
    { label: "Total calls", value: String(f.calls), strong: f.calls >= 12 },
    { label: "Avg duration alongside", value: `${f.avgDurationHrs}h`, strong: f.avgDurationHrs >= 12 },
    { label: "Speed consistency", value: `${Math.round(f.speedConsistency * 100)}%`, strong: f.speedConsistency >= 0.6 },
    { label: "Heading consistency", value: `${Math.round(f.headingConsistency * 100)}%`, strong: f.headingConsistency >= 0.6 },
    { label: "Vessel-class consistency", value: `${Math.round(f.classConsistency * 100)}%`, strong: f.classConsistency >= 0.6 },
    { label: "Near known infrastructure", value: f.nearInfrastructure ? "Yes" : "No", strong: f.nearInfrastructure },
    { label: "Imagery confirmed", value: f.imageryConfirmed ? "Yes" : "Not yet", strong: f.imageryConfirmed },
    { label: "Port-authority confirmed", value: f.portConfirmed ? "Yes" : "Not yet", strong: f.portConfirmed },
    { label: "Data freshness", value: `${f.freshnessDays}d`, strong: f.freshnessDays <= 3 },
  ];
}

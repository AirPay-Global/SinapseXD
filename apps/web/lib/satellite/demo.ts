/**
 * Deterministic demo generator for Satellite Intelligence (spec §4, §17 MVP).
 * There is no live satellite/imagery pipeline yet, so everything here is
 * clearly provenance-tagged (mostly "inferred" for candidate berths derived
 * from the AIS clustering narrative, "port_verified" for the known-berth
 * layer, "demo" where illustrative). Seeded per port so the canvas, berth
 * list and occupancy timeline are stable and internally consistent.
 */
import { quickEvidence } from "@/lib/evidence/build";
import type { EvidenceRecord } from "@/lib/evidence/types";
import type { Berth, BerthState, ConfidenceFactors, OccupancySlot, VesselTrack } from "./types";
import { scoreBerth } from "./detect";

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(portId: string): number {
  let h = 0;
  for (let i = 0; i < portId.length; i++) h = (h * 31 + portId.charCodeAt(i)) | 0;
  return Math.abs(h) + 101;
}

const CLASSES = ["Container", "Bulk carrier", "Tanker", "Ro-Ro", "General cargo"];
const COMMODITIES = ["Containers", "Dry bulk", "Liquid bulk", "Vehicles", "Break-bulk"];
const VESSEL_NAMES = [
  "MSC Aliya", "Maersk Cabinda", "CMA CGM Zanzibar", "Kota Jubilee", "Grande Lagos",
  "Ever Dignity", "ONE Serengeti", "Hapag Kariba", "Delmas Keta", "Gold Star Volta",
];

function berthEvidence(portId: string, name: string, state: BerthState, confidence: number, factors: ConfidenceFactors): EvidenceRecord {
  const status = state === "port_verified" || state === "published" ? "demo" : "demo";
  const ev = quickEvidence({
    metric: `Berth: ${name}`,
    value: state.replace("_", " "),
    objectRef: `object · berth:${portId}/${name}`,
    confidence,
    status,
    pillar: "AIS & Vessels",
    source: "aishub",
    silver: "silver_vessel_events",
    gold: "gold_candidate_berths",
    bronzeDetail: `${factors.calls} historical port calls from ${factors.vesselsObserved} distinct vessels, terrestrial + satellite AIS.`,
    goldDetail: `Geospatial clustering of prolonged low-speed events; heading-variation filter separates moored from congested. Multi-vessel evidence required before promotion.`,
    recommendation:
      state === "candidate" || state === "machine_inferred"
        ? "Validate against optical imagery and request port-authority confirmation before publishing."
        : undefined,
  });
  ev.steward = "Pipeline · berth_detector";
  ev.qualityScore = Math.min(0.95, 0.5 + factors.vesselsObserved * 0.04);
  ev.validations = [
    { rule: "multi-vessel evidence (≥3 vessels)", passed: factors.vesselsObserved >= 3 },
    { rule: "heading-variation < 25° (moored, not drifting)", passed: factors.headingConsistency >= 0.6 },
    { rule: "within 400m of known terminal geometry", passed: factors.nearInfrastructure },
    { rule: "imagery confirmation", passed: factors.imageryConfirmed },
    { rule: "port-authority confirmation", passed: factors.portConfirmed },
  ];
  return ev;
}

/** Berths for a port: a few known/verified plus AIS-discovered candidates. */
export function berthsForPort(portId: string): Berth[] {
  const r = rng(seedOf(portId));
  const count = 6 + Math.floor(r() * 3); // 6–8 berths
  const berths: Berth[] = [];
  for (let i = 0; i < count; i++) {
    // Lay berths along a quay line across the canvas.
    const t = (i + 0.5) / count;
    const x = 22 + t * 56 + (r() - 0.5) * 3;
    const y = 30 + Math.sin(t * Math.PI) * 6 + (r() - 0.5) * 2;
    const orientationDeg = 70 + Math.floor(r() * 40);
    const known = i < Math.max(2, Math.floor(count * 0.45));
    const vesselsObserved = known ? 8 + Math.floor(r() * 14) : 2 + Math.floor(r() * 4);
    const factors: ConfidenceFactors = {
      vesselsObserved,
      calls: vesselsObserved * (2 + Math.floor(r() * 4)),
      avgDurationHrs: 14 + Math.floor(r() * 30),
      speedConsistency: 0.55 + r() * 0.4,
      headingConsistency: (known ? 0.7 : 0.45) + r() * 0.25,
      classConsistency: 0.5 + r() * 0.45,
      nearInfrastructure: known || r() > 0.5,
      imageryConfirmed: known && r() > 0.4,
      portConfirmed: known && r() > 0.6,
      freshnessDays: Math.floor(r() * 6),
    };
    const confidence = scoreBerth(factors);
    let state: BerthState;
    if (factors.portConfirmed) state = "port_verified";
    else if (factors.imageryConfirmed) state = "analyst_reviewed";
    else if (confidence >= 0.55) state = "machine_inferred";
    else state = "candidate";

    const w = 3.2, h = 1.6;
    const polygon: [number, number][] = [
      [x - w, y - h], [x + w, y - h], [x + w, y + h], [x - w, y + h],
    ];
    const cls = CLASSES[Math.floor(r() * CLASSES.length)];
    const name = `Berth ${portId.slice(0, 3).toUpperCase()}-${i + 1}`;
    const occupied = r() > 0.5;
    berths.push({
      id: `${portId}-b${i + 1}`,
      portId,
      name,
      terminal: `Terminal ${String.fromCharCode(65 + (i % 3))}`,
      state,
      source: factors.imageryConfirmed ? "fusion" : "ais",
      x, y, orientationDeg, polygon,
      lengthM: 180 + Math.floor(r() * 220),
      estDepthM: Math.round((10 + r() * 8) * 10) / 10,
      vesselClasses: [cls, CLASSES[Math.floor(r() * CLASSES.length)]].filter((v, idx, a) => a.indexOf(v) === idx),
      commodity: COMMODITIES[CLASSES.indexOf(cls)] ?? "Mixed",
      confidence,
      factors,
      utilisationPct: 40 + Math.floor(r() * 55),
      avgServiceHrs: factors.avgDurationHrs,
      occupied,
      currentVessel: occupied ? VESSEL_NAMES[Math.floor(r() * VESSEL_NAMES.length)] : undefined,
      lastCall: `${Math.floor(r() * 48)}h ago`,
      evidence: berthEvidence(portId, name, state, confidence, factors),
    });
  }
  return berths;
}

/** Live vessel tracks approaching / within the port envelope. */
export function tracksForPort(portId: string): VesselTrack[] {
  const r = rng(seedOf(portId) + 7);
  const n = 7 + Math.floor(r() * 4);
  const navs = ["Under way using engine", "At anchor", "Moored", "Restricted manoeuvrability"];
  return Array.from({ length: n }, (_, i) => {
    const satellite = r() > 0.55;
    // A track drifting in from an edge toward the quay line (~y 34).
    const startEdge = r();
    const sx = startEdge < 0.5 ? 4 + r() * 12 : 84 + r() * 12;
    const sy = 8 + r() * 80;
    const pts: [number, number][] = [];
    const steps = 5 + Math.floor(r() * 4);
    const tx = 30 + r() * 40, ty = 30 + r() * 8;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      pts.push([
        sx + (tx - sx) * f + (r() - 0.5) * 3,
        sy + (ty - sy) * f + (r() - 0.5) * 3,
      ]);
    }
    return {
      mmsi: String(600000000 + Math.floor(r() * 99999999)),
      name: VESSEL_NAMES[i % VESSEL_NAMES.length],
      vesselClass: CLASSES[Math.floor(r() * CLASSES.length)],
      source: satellite ? "satellite" : "terrestrial",
      signalConfidence: satellite ? 0.6 + r() * 0.3 : 0.8 + r() * 0.18,
      lastSignal: `${Math.floor(r() * 55)} min ago`,
      speedKn: Math.round(r() * 160) / 10,
      headingDeg: Math.floor(r() * 360),
      navStatus: navs[Math.floor(r() * navs.length)],
      destination: portId.toUpperCase(),
      eta: `${Math.floor(r() * 36)}h`,
      track: pts,
    };
  });
}

/** 14-day occupancy timeline per berth (spec §4.3). */
export function occupancyForPort(portId: string, berths: Berth[]): OccupancySlot[] {
  const r = rng(seedOf(portId) + 13);
  return berths.map((b) => {
    const segments: OccupancySlot["segments"] = [];
    let day = r() * 1.5;
    while (day < 14) {
      const dwell = 0.4 + r() * 1.8;
      const gap = 0.3 + r() * 1.6;
      if (day + dwell > 14) break;
      segments.push({
        start: Math.round(day * 10) / 10,
        end: Math.round((day + dwell) * 10) / 10,
        vessel: VESSEL_NAMES[Math.floor(r() * VESSEL_NAMES.length)],
        vesselClass: CLASSES[Math.floor(r() * CLASSES.length)],
      });
      day += dwell + gap;
    }
    return { berthId: b.id, berthName: b.name, segments };
  });
}

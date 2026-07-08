/**
 * Shared types for the 6 external data pillars.
 * Sinapse CRM is a deferred, optional 7th source — nothing here depends on it.
 */

export type OrgType = "PORT" | "GOVERNMENT" | "DFI" | "AFCFTA";

export type DataPillar =
  | "ais"
  | "trade"
  | "market"
  | "weather"
  | "financial"
  | "sdg";

// ── Feed freshness ──────────────────────────────────────
// Every pillar-backed surface reports one of these so a late or failed
// ingestion never renders as a real zero. Dashboards and the pipeline
// share this vocabulary.
export type FeedStatus = "live" | "loading" | "stale" | "down";

export interface PillarFeed {
  status: FeedStatus;
  /** ISO timestamp of the most recent successful ingestion, or null when never delivered. */
  asOf: string | null;
}

// ── Pillar 1: AIS & Vessels ─────────────────────────────
export type VesselStatus =
  | "underway"
  | "at_anchor"
  | "moored"
  | "expected"
  | "delayed";

export interface VesselPosition {
  /** MMSI is the reliable AIS identity key; IMO is often absent from AIS reports. */
  mmsi: string;
  /** May be empty — many AIS transponders don't broadcast IMO. */
  imo: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  speedKn: number;
  heading: number;
  status: VesselStatus;
  destinationPort: string;
  etaIso: string;
}

// ── Pillar 2: Trade Analytics ───────────────────────────
export interface CorridorFlow {
  corridor: string;
  originCountry: string;
  destinationCountry: string;
  throughputTeu: number;
  tradeValueUsd: number;
  avgTransitDays: number;
  periodIso: string;
}

// ── Pillar 3: Market Intel ──────────────────────────────
export interface FreightRatePoint {
  route: string;
  dateIso: string;
  rateUsdPerFeu: number;
  indexSource: string;
}

// ── Pillar 4: Weather & Climate ─────────────────────────
export type DisruptionLevel = "low" | "moderate" | "high" | "severe";

export interface MarineConditions {
  portId: string;
  dateIso: string;
  waveHeightM: number;
  windSpeedKn: number;
  disruptionRisk: DisruptionLevel;
}

// ── Pillar 5: Financial Data ────────────────────────────
export interface EconomicIndicator {
  country: string;
  indicator: string;
  value: number;
  unit: string;
  year: number;
  source: string;
}

// ── Pillar 6: SDG Reporting ─────────────────────────────
export interface SdgIndicator {
  country: string;
  goal: 8 | 9 | 10 | 17;
  indicatorCode: string;
  label: string;
  value: number;
  target: number;
  year: number;
}

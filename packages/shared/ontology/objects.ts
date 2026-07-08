/**
 * Sinapse ontology — canonical object model (Master Build Plan v2, Principle #1:
 * ontology-first, not database-first).
 *
 * Every data product resolves to these canonical objects via stable string keys,
 * so cross-pillar analytics is a join on shared keys, never an ad-hoc match.
 * Keys are meaningful and deterministic (ISO3 for countries, slugs for ports),
 * not random UUIDs — a re-load resolves to the same object.
 */

export type OntologyObjectType =
  | "country"
  | "port"
  | "corridor"
  | "commodity"
  | "shippingLine";

/** A typed reference to a canonical object. */
export interface OntologyRef {
  type: OntologyObjectType;
  id: string;
}

// ── Country ─────────────────────────────────────────────
export interface Country {
  /** ISO 3166-1 alpha-3, the continental join key (e.g. "ZAF"). */
  id: string;
  name: string;
  iso2: string;
  /** Regional Economic Community, e.g. "SADC" | "ECOWAS" | "EAC" | "COMESA" | "ECCAS". */
  rec: string | null;
  isAfcftaMember: boolean;
}

// ── Port ────────────────────────────────────────────────
export interface Port {
  /** Canonical slug, e.g. "durban". */
  id: string;
  name: string;
  /** FK → Country.id (ISO3). */
  countryId: string;
  lat: number;
  lng: number;
  /** UN/LOCODE where known, e.g. "ZADUR". */
  unlocode: string | null;
}

// ── Corridor ────────────────────────────────────────────
export interface Corridor {
  /** Canonical slug, e.g. "durban-lusaka". */
  id: string;
  name: string;
  /** Coastal gateway port. */
  originPortId: string;
  /** Destination port, or null for inland corridors ending at a landlocked hub. */
  destinationPortId: string | null;
  /** Free-text destination when it isn't a port, e.g. "Lusaka". */
  destinationName: string | null;
  /** ISO3s the corridor passes through, origin → destination. */
  countryIds: string[];
}

// ── Commodity / vessel-class taxonomy ───────────────────
// Reconciles PortWatch vessel classes with dashboard commodity buckets so the
// two never drift. `vesselClass` matches the shared VesselClass type.
export interface Commodity {
  /** Canonical id, aligned to vessel class, e.g. "container". */
  id: string;
  label: string;
  vesselClass: string;
  /** Harmonized System chapter for AfCFTA interoperability, where applicable. */
  hsChapter: string | null;
}

// ── Shipping line ───────────────────────────────────────
export interface ShippingLine {
  id: string;
  name: string;
  aliases: string[];
}

// ── Source crosswalk ────────────────────────────────────
// Resolves a data product's native identifier to a canonical object.
// e.g. { source: "portwatch", nativeId: "port1411", type: "port", objectId: "yatsushiro" }.
export interface SourceMap {
  source: string;
  nativeId: string;
  type: OntologyObjectType;
  objectId: string;
}

// ── Evidence envelope (Principle #4 / #7) ───────────────
// Every Silver/Gold value is wrapped with provenance so a metric is never a
// bare number. `confidence` is 0–1; `lineageRef` points at the Bronze object
// (or transform) the value derives from.
export type Confidence = number;

export interface Evidence<T> {
  value: T;
  source: string;
  /** ISO-8601 timestamp of the underlying observation. */
  asOf: string;
  confidence: Confidence;
  /** Opaque reference into the lineage catalog (Bronze object / transform id). */
  lineageRef: string | null;
}

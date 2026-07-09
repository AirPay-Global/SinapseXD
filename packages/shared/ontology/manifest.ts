/**
 * Ontology manifest — the declarative single source of truth for the object
 * model (Master Build Plan v2, Principle #1; Foundry-style ontology-first).
 *
 * Each object type declares its canonical key, backing table, and typed links.
 * The Ontology SDK reads this instead of hard-coding table/column names, so
 * "query objects, not tables" is enforced by construction and there is exactly
 * one place the physical mapping lives.
 */
import type { OntologyObjectType } from "./objects";

export interface LinkSpec {
  /** Accessor name exposed by the SDK, e.g. "country". */
  name: string;
  /** Target object type. */
  target: OntologyObjectType;
  /** Foreign-key column on the *source* row holding the target's key. */
  via: string;
  cardinality: "one" | "many";
}

export interface ObjectTypeSpec {
  type: OntologyObjectType;
  /** Backing dimension table. */
  table: string;
  /** Canonical key column. */
  key: string;
  links: LinkSpec[];
}

export const ONTOLOGY: Record<OntologyObjectType, ObjectTypeSpec> = {
  country: {
    type: "country",
    table: "ont_country",
    key: "id",
    links: [{ name: "ports", target: "port", via: "country_iso3", cardinality: "many" }],
  },
  port: {
    type: "port",
    table: "ont_port",
    key: "id",
    links: [{ name: "country", target: "country", via: "country_iso3", cardinality: "one" }],
  },
  corridor: {
    type: "corridor",
    table: "ont_corridor",
    key: "id",
    links: [
      { name: "originPort", target: "port", via: "origin_port_id", cardinality: "one" },
      { name: "destinationPort", target: "port", via: "destination_port_id", cardinality: "one" },
    ],
  },
  commodity: { type: "commodity", table: "ont_commodity", key: "id", links: [] },
  shippingLine: { type: "shippingLine", table: "ont_shipping_line", key: "id", links: [] },
};

/** Gold marts exposed as ontology-derived reads (named, not raw view strings). */
export const ONTOLOGY_MARTS = {
  portActivity30d: "gold_port_activity_30d",
  portCallsDaily: "gold_port_calls_daily",
  portThroughputMonthly: "gold_port_throughput_monthly",
  corridorGatewayActivity: "gold_corridor_gateway_activity",
} as const;

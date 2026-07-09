/**
 * Object-type catalogue for the Ontology Explorer (Design Bible §6). Mirrors
 * the ontology manifest + the Stakeholder Catalogue: every business object,
 * its Gold intelligence output, and whether it's live on the lakehouse today.
 * Client-safe (no server deps) — the Explorer renders from this; live objects
 * with a built profile carry an href.
 */

export type ObjStatus = "live" | "demo" | "planned";

export interface ObjectType {
  slug: string;
  name: string;
  /** Icon key → path in OBJECT_ICON. */
  icon: string;
  status: ObjStatus;
  /** Instance count, or null when the data product isn't wired yet. */
  count: number | null;
  goldOutput: string;
  description: string;
  /** Route to a representative profile, when one is built. */
  href?: string;
}

export const OBJECT_ICON: Record<string, string> = {
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18",
  port: "M3 21h18M5 21V10l7-4 7 4v11M9 21v-5h6v5",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4M8 17h6a3 3 0 0 0 3-3V9",
  box: "M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10",
  ship: "M3 14l9 4 9-4M4 14V8h16v6M8 8V5h8v3",
  cash: "M3 6h18v12H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  rail: "M8 3v18M16 3v18M5 8h14M5 16h14",
  flag: "M5 21V4l7 2 7-2v11l-7 2-7-2",
  crest: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z",
};

export const OBJECT_TYPES: ObjectType[] = [
  { slug: "countries", name: "Countries", icon: "globe", status: "live", count: 55, goldOutput: "Country Competitiveness Index", description: "ISO3 nations with REC membership and AfCFTA status.", href: "/ontology/country/zaf" },
  { slug: "ports", name: "Ports", icon: "port", status: "live", count: 7, goldOutput: "Port Competitiveness Score", description: "Coastal gateways with PortWatch daily activity.", href: "/ontology/port/durban" },
  { slug: "corridors", name: "Trade Corridors", icon: "route", status: "live", count: 7, goldOutput: "Corridor Performance Index", description: "Gateway → inland-hub freight routes.", href: "/ontology/corridor/durban-lusaka" },
  { slug: "commodities", name: "Commodities", icon: "box", status: "demo", count: 5, goldOutput: "Import Substitution Index", description: "Vessel-class & HS commodity taxonomy." },
  { slug: "recs", name: "Regions / RECs", icon: "globe", status: "demo", count: 5, goldOutput: "Regional Integration Index", description: "SADC, ECOWAS, EAC, COMESA, ECCAS." },
  { slug: "shipping-lines", name: "Shipping Lines", icon: "ship", status: "demo", count: 12, goldOutput: "Reliability Score", description: "Carriers calling the pilot ports." },
  { slug: "vessels", name: "Vessels", icon: "ship", status: "planned", count: null, goldOutput: "Delay Prediction", description: "AIS positions — needs a Spire/AISHub feed." },
  { slug: "customers", name: "Customers", icon: "flag", status: "planned", count: null, goldOutput: "Customer Health Score", description: "Port CRM accounts (deferred data product)." },
  { slug: "projects", name: "Projects", icon: "flag", status: "planned", count: null, goldOutput: "Development Impact Score", description: "DFI project pipeline (PMIS)." },
  { slug: "investments", name: "Investments", icon: "cash", status: "planned", count: null, goldOutput: "Investment Readiness Score", description: "Finance instruments & trade multipliers." },
  { slug: "border-posts", name: "Border Posts", icon: "flag", status: "planned", count: null, goldOutput: "Border Efficiency Score", description: "Customs transit points." },
  { slug: "rail", name: "Rail Networks", icon: "rail", status: "planned", count: null, goldOutput: "Connectivity Index", description: "Rail operations graph." },
  { slug: "payment-corridors", name: "Payment Corridors", icon: "cash", status: "planned", count: null, goldOutput: "Payment Friction Index", description: "PAPSS settlement paths." },
  { slug: "aprm", name: "APRM Indicators", icon: "crest", status: "planned", count: null, goldOutput: "Governance Evidence Score", description: "Governance evidence & Agenda 2063 targets." },
];

export const STATUS_TEXT: Record<ObjStatus, string> = { live: "text-success", demo: "text-warning", planned: "text-muted-foreground" };
export const STATUS_VAR: Record<ObjStatus, string> = { live: "var(--success)", demo: "var(--warning)", planned: "var(--muted-foreground)" };

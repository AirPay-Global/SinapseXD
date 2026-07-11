/**
 * Digital Twin hierarchy (UI Evolution spec, Priority 7):
 * Africa → Region → Country → Corridor → Port → Terminal → Berth → Vessel →
 * Container. One navigable tree; each node carries its live/demo/planned
 * provenance and a few headline KPIs. Deep levels (terminal and below) need
 * the CRM/IoT data products and are honestly marked planned. Client-safe.
 */

export type TwinLevel =
  | "africa"
  | "region"
  | "country"
  | "corridor"
  | "port"
  | "terminal"
  | "berth"
  | "vessel"
  | "container";

export const LEVEL_LABEL: Record<TwinLevel, string> = {
  africa: "Continent",
  region: "Region",
  country: "Country",
  corridor: "Corridor",
  port: "Port",
  terminal: "Terminal",
  berth: "Berth",
  vessel: "Vessel",
  container: "Container",
};

export interface TwinKpi {
  name: string;
  value: string;
}

export interface TwinNode {
  id: string;
  level: TwinLevel;
  name: string;
  status: "live" | "demo" | "planned";
  /** Route to the object profile, when one exists. */
  href?: string;
  kpis: TwinKpi[];
  note?: string;
  children?: TwinNode[];
}

const containers: TwinNode[] = [
  {
    id: "cont-msku481", level: "container", name: "MSKU 481-220-9", status: "planned",
    kpis: [{ name: "Type", value: "40ft reefer" }, { name: "Cargo", value: "Citrus, −0.5°C" }, { name: "Destination", value: "Lusaka" }],
    note: "Container-level tracking needs the CRM manifest + IoT data products (deferred).",
  },
  {
    id: "cont-tclu330", level: "container", name: "TCLU 330-871-4", status: "planned",
    kpis: [{ name: "Type", value: "20ft dry" }, { name: "Cargo", value: "Copper cathode" }, { name: "Destination", value: "Durban → export" }],
    note: "Container-level tracking needs the CRM manifest + IoT data products (deferred).",
  },
];

const vessels: TwinNode[] = [
  {
    id: "vessel-msc-aliya", level: "vessel", name: "MSC Aliya", status: "demo",
    kpis: [{ name: "IMO", value: "9387421" }, { name: "Status", value: "At berth 108" }, { name: "ETD", value: "10 Jul 04:00" }],
    note: "Live positions arrive when an AIS feed key (AISHub/Spire) is set.",
    children: containers,
  },
  {
    id: "vessel-kota-jubilee", level: "vessel", name: "Kota Jubilee", status: "demo",
    kpis: [{ name: "IMO", value: "9634214" }, { name: "Status", value: "At anchor · 14h" }, { name: "ETB", value: "11 Jul 22:00" }],
    children: [],
  },
];

const berths: TwinNode[] = [
  {
    id: "berth-108", level: "berth", name: "Berth 108", status: "planned",
    kpis: [{ name: "LOA max", value: "300 m" }, { name: "Draft", value: "12.8 m" }, { name: "Occupancy (7d)", value: "82%" }],
    note: "Berth telemetry needs the port CRM data product (deferred).",
    children: vessels,
  },
  {
    id: "berth-203", level: "berth", name: "Berth 203 (reefer)", status: "planned",
    kpis: [{ name: "LOA max", value: "260 m" }, { name: "Reefer plugs", value: "480" }, { name: "Occupancy (7d)", value: "74%" }],
    children: [],
  },
];

const terminals: TwinNode[] = [
  {
    id: "term-dct1", level: "terminal", name: "Durban Container Terminal — Pier 1", status: "planned",
    kpis: [{ name: "Design capacity", value: "0.9M TEU/yr" }, { name: "Utilisation", value: "88%" }, { name: "Cranes", value: "7 STS" }],
    note: "Terminal telemetry needs the port CRM data product (deferred).",
    children: berths,
  },
  {
    id: "term-dct2", level: "terminal", name: "Durban Container Terminal — Pier 2", status: "planned",
    kpis: [{ name: "Design capacity", value: "2.9M TEU/yr" }, { name: "Utilisation", value: "79%" }, { name: "Cranes", value: "17 STS" }],
    children: [],
  },
];

const durban: TwinNode = {
  id: "port-durban", level: "port", name: "Port of Durban", status: "live", href: "/ontology/port/durban",
  kpis: [{ name: "Port calls (30d)", value: "409" }, { name: "Congestion", value: "61 / 100" }, { name: "Disruption risk", value: "high (Thu)" }],
  children: terminals,
};

const corridors: TwinNode[] = [
  {
    id: "corridor-durban-lusaka", level: "corridor", name: "Durban–Lusaka (North-South)", status: "live", href: "/ontology/corridor/durban-lusaka",
    kpis: [{ name: "Gateway throughput", value: "+18% YoY" }, { name: "Transit", value: "8.4 days" }, { name: "Trade value", value: "$2.1B/yr" }],
    children: [durban],
  },
  {
    id: "corridor-maputo", level: "corridor", name: "Maputo Corridor", status: "demo",
    kpis: [{ name: "Gateway", value: "Maputo" }, { name: "Transit", value: "3.1 days" }],
    children: [],
  },
];

const countriesSouthern: TwinNode[] = [
  {
    id: "country-zaf", level: "country", name: "South Africa", status: "live", href: "/ontology/country/zaf",
    kpis: [{ name: "Ports live", value: "1 (Durban)" }, { name: "REC", value: "SADC" }, { name: "AfCFTA", value: "Member" }],
    children: corridors,
  },
  { id: "country-zmb", level: "country", name: "Zambia", status: "demo", kpis: [{ name: "Role", value: "Landlocked · corridor destination" }, { name: "REC", value: "SADC/COMESA" }], children: [] },
  { id: "country-moz", level: "country", name: "Mozambique", status: "demo", kpis: [{ name: "Gateway", value: "Maputo" }, { name: "REC", value: "SADC" }], children: [] },
];

export const TWIN_ROOT: TwinNode = {
  id: "africa",
  level: "africa",
  name: "Africa",
  status: "live",
  kpis: [
    { name: "AfCFTA members", value: "55 states" },
    { name: "Pilot ports live", value: "7" },
    { name: "Corridors tracked", value: "7" },
    { name: "Intra-African trade share", value: "15.2%" },
  ],
  children: [
    {
      id: "region-southern", level: "region", name: "Southern Africa", status: "live",
      kpis: [{ name: "Pilot ports", value: "Durban" }, { name: "REC", value: "SADC" }],
      children: countriesSouthern,
    },
    {
      id: "region-east", level: "region", name: "East Africa", status: "live",
      kpis: [{ name: "Pilot ports", value: "Mombasa · Dar · Djibouti" }, { name: "RECs", value: "EAC · COMESA" }],
      children: [
        { id: "country-ken", level: "country", name: "Kenya", status: "live", href: "/ontology/country/ken", kpis: [{ name: "Gateway", value: "Mombasa" }], children: [] },
        { id: "country-tza", level: "country", name: "Tanzania", status: "live", href: "/ontology/country/tza", kpis: [{ name: "Gateway", value: "Dar es Salaam" }], children: [] },
        { id: "country-dji", level: "country", name: "Djibouti", status: "live", href: "/ontology/country/dji", kpis: [{ name: "Gateway", value: "Djibouti" }], children: [] },
      ],
    },
    {
      id: "region-west", level: "region", name: "West Africa", status: "live",
      kpis: [{ name: "Pilot ports", value: "Lagos · Lomé · Tema" }, { name: "REC", value: "ECOWAS" }],
      children: [
        { id: "country-nga", level: "country", name: "Nigeria", status: "live", href: "/ontology/country/nga", kpis: [{ name: "Gateway", value: "Lagos (Apapa)" }], children: [] },
        { id: "country-tgo", level: "country", name: "Togo", status: "live", href: "/ontology/country/tgo", kpis: [{ name: "Gateway", value: "Lomé" }], children: [] },
        { id: "country-gha", level: "country", name: "Ghana", status: "live", href: "/ontology/country/gha", kpis: [{ name: "Gateway", value: "Tema" }], children: [] },
      ],
    },
    { id: "region-north", level: "region", name: "North Africa", status: "planned", kpis: [{ name: "Coverage", value: "Next wave" }], children: [] },
    { id: "region-central", level: "region", name: "Central Africa", status: "planned", kpis: [{ name: "Coverage", value: "Next wave" }], children: [] },
  ],
};

/** Depth-first search for a node + its ancestor path. */
export function findPath(root: TwinNode, id: string): TwinNode[] | null {
  if (root.id === id) return [root];
  for (const child of root.children ?? []) {
    const path = findPath(child, id);
    if (path) return [root, ...path];
  }
  return null;
}

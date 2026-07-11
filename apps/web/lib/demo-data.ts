/**
 * Deterministic demo data for the 6 external pillars.
 *
 * Stands in for the live ingestion pipeline while API keys are provisioned —
 * the dashboards read the same shapes the pipeline will deliver, so swapping
 * in Supabase queries later is a data-source change, not a UI change.
 */
import type {
  CorridorFlow,
  FreightRatePoint,
  MarineConditions,
  SdgIndicator,
  VesselPosition,
} from "@sinapse/shared";

// Mulberry32 — seeded PRNG so every render shows the same "live" data
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

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 6, 7); // fixed "today" for deterministic output

function isoDay(offset: number): string {
  return new Date(BASE + offset * DAY).toISOString().slice(0, 10);
}

export const PORTS = [
  { id: "durban", name: "Durban", country: "South Africa", lat: -29.87, lng: 31.03 },
  { id: "mombasa", name: "Mombasa", country: "Kenya", lat: -4.06, lng: 39.65 },
  { id: "lagos", name: "Lagos (Apapa)", country: "Nigeria", lat: 6.44, lng: 3.36 },
  { id: "lome", name: "Lomé", country: "Togo", lat: 6.13, lng: 1.29 },
  { id: "djibouti", name: "Djibouti", country: "Djibouti", lat: 11.6, lng: 43.15 },
  { id: "dar", name: "Dar es Salaam", country: "Tanzania", lat: -6.82, lng: 39.29 },
  { id: "tema", name: "Tema", country: "Ghana", lat: 5.63, lng: 0.01 },
];

// ── Pillar 1: AIS vessel queue ──────────────────────────
const VESSEL_NAMES = [
  "MSC Aliya", "Maersk Cabinda", "CMA CGM Zanzibar", "Kota Jubilee",
  "Grande Lagos", "Ever Dignity", "Safmarine Nokwanda", "PIL Kikwit",
  "ONE Serengeti", "Hapag Kariba", "Delmas Keta", "Gold Star Volta",
];
const VESSEL_TYPES = ["Container", "Bulk carrier", "Tanker", "Ro-Ro", "General cargo"];

export function vesselQueue(portId = "durban"): VesselPosition[] {
  const r = rng(portId.length * 7919 + 11);
  const port = PORTS.find((p) => p.id === portId) ?? PORTS[0];
  return VESSEL_NAMES.map((name, i) => {
    const hoursOut = Math.round(2 + r() * 96);
    const statuses = ["underway", "at_anchor", "expected", "underway", "delayed"] as const;
    return {
      mmsi: String(600000000 + Math.floor(r() * 99999999)),
      imo: String(9300000 + Math.floor(r() * 99999)),
      name,
      type: VESSEL_TYPES[Math.floor(r() * VESSEL_TYPES.length)],
      lat: port.lat + (r() - 0.5) * 4,
      lng: port.lng + (r() - 0.5) * 4,
      speedKn: Math.round(r() * 180) / 10,
      heading: Math.floor(r() * 360),
      status: statuses[i % statuses.length],
      destinationPort: port.name,
      etaIso: new Date(BASE + hoursOut * 3_600_000).toISOString(),
    };
  }).sort((a, b) => a.etaIso.localeCompare(b.etaIso));
}

// Daily port calls, 30 days
export function portCalls30d(portId = "durban") {
  const r = rng(portId.length * 104729 + 3);
  return Array.from({ length: 30 }, (_, i) => ({
    date: isoDay(i - 29),
    arrivals: Math.round(8 + r() * 10 + Math.sin(i / 4) * 3),
    departures: Math.round(7 + r() * 10 + Math.sin((i - 1) / 4) * 3),
  }));
}

// ── Pillar 2: Trade analytics ───────────────────────────
export const COMMODITIES = [
  "Containers", "Minerals & ores", "Petroleum", "Agriculture", "Vehicles", "Other",
];

export function throughputByCommodity(portId = "durban") {
  const r = rng(portId.length * 15485863 + 5);
  return Array.from({ length: 12 }, (_, m) => {
    const month = new Date(Date.UTC(2025, 7 + m, 1)).toISOString().slice(0, 7);
    const row: Record<string, number | string> = { month };
    COMMODITIES.forEach((c, ci) => {
      const base = [120, 85, 60, 45, 25, 18][ci];
      row[c] = Math.round(base * (0.85 + r() * 0.4) * (1 + m * 0.012));
    });
    return row;
  });
}

export function corridorFlows(): CorridorFlow[] {
  const r = rng(42);
  const corridors: Array<[string, string, string]> = [
    ["Durban–Lusaka (North-South)", "South Africa", "Zambia"],
    ["Mombasa–Kampala (Northern)", "Kenya", "Uganda"],
    ["Dar–Kigali (Central)", "Tanzania", "Rwanda"],
    ["Djibouti–Addis Ababa", "Djibouti", "Ethiopia"],
    ["Lomé–Ouagadougou", "Togo", "Burkina Faso"],
    ["Tema–Bamako", "Ghana", "Mali"],
    ["Lagos–Niamey", "Nigeria", "Niger"],
  ];
  return corridors.map(([corridor, origin, dest]) => ({
    corridor,
    originCountry: origin,
    destinationCountry: dest,
    throughputTeu: Math.round(40_000 + r() * 220_000),
    tradeValueUsd: Math.round((0.4 + r() * 2.8) * 1e9),
    avgTransitDays: Math.round((4 + r() * 14) * 10) / 10,
    periodIso: "2026-06",
  }));
}

// ── Pillar 3: Market intel — freight rates, 90 days ─────
export const FREIGHT_ROUTES = [
  "Asia → East Africa",
  "Asia → West Africa",
  "Europe → West Africa",
  "Intra-Africa coastal",
];

export function freightRates90d(): FreightRatePoint[] {
  const r = rng(77);
  const bases = [2850, 3400, 2100, 1650];
  const out: FreightRatePoint[] = [];
  FREIGHT_ROUTES.forEach((route, ri) => {
    let level = bases[ri];
    for (let d = 0; d < 90; d += 3) {
      level = Math.max(800, level * (0.985 + r() * 0.035));
      out.push({
        route,
        dateIso: isoDay(d - 89),
        rateUsdPerFeu: Math.round(level),
        indexSource: "FBX",
      });
    }
  });
  return out;
}

// ── Pillar 4: Weather & marine conditions ───────────────
export function marineConditions(): MarineConditions[] {
  const r = rng(13);
  return PORTS.map((p) => {
    const wave = Math.round((0.4 + r() * 3.4) * 10) / 10;
    const wind = Math.round(5 + r() * 30);
    const risk =
      wave > 3 || wind > 28 ? "severe"
      : wave > 2.2 || wind > 22 ? "high"
      : wave > 1.4 || wind > 15 ? "moderate"
      : "low";
    return {
      portId: p.id,
      dateIso: isoDay(0),
      waveHeightM: wave,
      windSpeedKn: wind,
      disruptionRisk: risk,
    };
  });
}

// ── Pillar 5: Financial data ────────────────────────────
export function revenueVsForecast(portId = "durban") {
  const r = rng(portId.length * 2946901);
  return Array.from({ length: 12 }, (_, m) => {
    const month = new Date(Date.UTC(2025, 7 + m, 1)).toISOString().slice(0, 7);
    const forecast = Math.round(4.2e6 * (1 + m * 0.015));
    return {
      month,
      forecastUsd: forecast,
      actualUsd: m < 11 ? Math.round(forecast * (0.88 + r() * 0.24)) : null,
    };
  });
}

// ── Pillar 6: SDG indicators ────────────────────────────
export function sdgIndicators(): SdgIndicator[] {
  const rows: Array<[8 | 9 | 10 | 17, string, string, number, number]> = [
    [8, "8.1.1", "GDP growth per capita (annual %)", 3.4, 5.0],
    [8, "8.2.1", "Growth rate of real GDP per employed person", 2.1, 4.0],
    [9, "9.1.2", "Freight volumes by mode of transport (index)", 68, 100],
    [9, "9.4.1", "CO₂ emission per unit of value added", 0.42, 0.3],
    [10, "10.a.1", "Zero-tariff lines for LDC imports (%)", 61, 100],
    [10, "10.1.1", "Growth of income, bottom 40% (%)", 2.8, 4.5],
    [17, "17.11.1", "LDC share of global exports (%)", 1.1, 2.0],
    [17, "17.10.1", "Worldwide weighted tariff average (%)", 6.8, 4.0],
  ];
  return rows.map(([goal, code, label, value, target]) => ({
    country: "AfCFTA aggregate",
    goal,
    indicatorCode: code,
    label,
    value,
    target,
    year: 2025,
  }));
}

// ── Headline KPIs ───────────────────────────────────────
export function portKpis(portId = "durban") {
  const calls = portCalls30d(portId);
  const arrivals = calls.reduce((s, c) => s + c.arrivals, 0);
  const queue = vesselQueue(portId);
  const conditions = marineConditions().find((c) => c.portId === portId);
  // Seeded per port so every port renders distinct (but stable) demo values.
  const r = rng(portId.length * 15013 + 29);
  return {
    portCalls30d: arrivals,
    vesselsInbound: 8 + Math.floor(r() * 9),
    avgWaitHours: Math.round((12 + r() * 14) * 10) / 10,
    throughputTeu30d: Math.round((90_000 + r() * 180_000) / 100) * 100,
    disruptionRisk: conditions?.disruptionRisk ?? "low",
  };
}

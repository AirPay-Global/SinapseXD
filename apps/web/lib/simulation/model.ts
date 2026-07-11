/**
 * What-if simulation model (UI Evolution spec, Priority 8). A deterministic,
 * transparent toy model over four levers — investment, capacity, border
 * dwell, tariffs — producing the spec's output set (trade growth, GDP, jobs,
 * carbon, SDGs, Agenda 2063, risks, ROI). Every output is a modelled
 * estimate, not a measurement; the coefficients are illustrative and shown to
 * the user. Real calibrated models arrive with v2 Phase 5. Client-safe.
 */

export interface SimLevers {
  /** Capital deployed, USD millions (0–200). */
  investmentUsdM: number;
  /** Port/terminal design-capacity uplift, % (0–50). */
  capacityIncreasePct: number;
  /** Border/anchorage dwell reduction, % (0–60). */
  dwellReductionPct: number;
  /** Tariff change, % (−10 … +10; negative = cut). */
  tariffChangePct: number;
}

export interface SimOutputs {
  investmentUsdM: number;
  capacityIncreasePct: number;
  tradeGrowthPct: number;
  tradeGrowthUsdM: number;
  gdpImpactUsdM: number;
  jobsCreated: number;
  /** Net CO₂ change, kilotonnes/yr — negative is a reduction. */
  carbonKtPerYear: number;
  sdgsAdvanced: string[];
  agenda2063: string;
  risks: string[];
  /** Annualised return on the invested capital, %; null when no capital. */
  roiPct: number | null;
  paybackYears: number | null;
}

/** Corridor economic base the percentages act on (Durban–Lusaka scale). */
const BASE_TRADE_USD_M = 2_100;

export function simulate(l: SimLevers): SimOutputs {
  const tradeGrowthPct =
    l.capacityIncreasePct * 0.45 + l.dwellReductionPct * 0.30 - l.tariffChangePct * 0.55;
  const tradeGrowthUsdM = (tradeGrowthPct / 100) * BASE_TRADE_USD_M;
  const gdpImpactUsdM = tradeGrowthUsdM * 0.32;
  const jobsCreated = Math.max(0, Math.round(l.investmentUsdM * 38 + Math.max(0, tradeGrowthUsdM) * 5.5));
  // Less idling at anchor/border cuts emissions; more throughput adds them.
  const carbonKtPerYear = Math.round((l.capacityIncreasePct * 0.9 - l.dwellReductionPct * 1.8) * 10) / 10;

  const sdgs = new Set<string>();
  if (l.investmentUsdM > 0) { sdgs.add("SDG 9 · Infrastructure"); sdgs.add("SDG 8 · Decent work"); }
  if (l.dwellReductionPct > 0 || l.tariffChangePct < 0) sdgs.add("SDG 10 · Reduced inequalities");
  if (carbonKtPerYear < 0) sdgs.add("SDG 13 · Climate action");
  if (tradeGrowthPct > 0) sdgs.add("SDG 17 · Partnerships");

  const risks: string[] = [];
  if (l.investmentUsdM >= 80) risks.push("Execution risk — capital programme above the port's delivery track record.");
  if (l.tariffChangePct < 0) risks.push(`Revenue risk — a ${Math.abs(l.tariffChangePct)}% tariff cut must be won back through volume.`);
  if (l.tariffChangePct > 0) risks.push("Diversion risk — higher tariffs push transit volume to competing gateways.");
  if (l.dwellReductionPct >= 25) risks.push("Political risk — deep dwell cuts need bilateral customs cooperation.");
  if (l.capacityIncreasePct >= 30) risks.push("Demand risk — capacity added ahead of demand strands the asset.");
  if (risks.length === 0) risks.push("Low modelled risk at these lever settings.");

  const annualGainUsdM = Math.max(0, tradeGrowthUsdM) * 0.12; // operator-side margin capture
  const roiPct = l.investmentUsdM > 0 ? Math.round((annualGainUsdM / l.investmentUsdM) * 1000) / 10 : null;
  const paybackYears =
    l.investmentUsdM > 0 && annualGainUsdM > 0 ? Math.round((l.investmentUsdM / annualGainUsdM) * 10) / 10 : null;

  return {
    investmentUsdM: l.investmentUsdM,
    capacityIncreasePct: l.capacityIncreasePct,
    tradeGrowthPct: Math.round(tradeGrowthPct * 10) / 10,
    tradeGrowthUsdM: Math.round(tradeGrowthUsdM),
    gdpImpactUsdM: Math.round(gdpImpactUsdM),
    jobsCreated,
    carbonKtPerYear,
    sdgsAdvanced: [...sdgs],
    agenda2063: tradeGrowthPct > 0 ? "Goal 10 · World-class infrastructure — positive contribution" : "Goal 10 · No modelled contribution at these settings",
    risks,
    roiPct,
    paybackYears,
  };
}

export interface Scenario {
  name: string;
  objectRef: string;
  description: string;
  levers: SimLevers;
}

/** Preset scenarios, keyed by the decision that motivates them. */
export const SCENARIOS: Record<string, Scenario> = {
  default: {
    name: "Corridor investment — blank sheet",
    objectRef: "object · corridor:durban-lusaka",
    description: "Start from zero and pull the levers yourself.",
    levers: { investmentUsdM: 40, capacityIncreasePct: 10, dwellReductionPct: 10, tariffChangePct: 0 },
  },
  "dec-reefer-leakage": {
    name: "Reefer tariff reconciliation",
    objectRef: "object · tariff:reefer @ port:durban",
    description: "Close the reefer billing gap; small systems spend, no capacity change.",
    levers: { investmentUsdM: 2, capacityIncreasePct: 0, dwellReductionPct: 0, tariffChangePct: 4 },
  },
  "dec-msc-renewal": {
    name: "MSC renewal — 3% concession",
    objectRef: "object · customer:MSC",
    description: "Trade a rate concession for a berth-window guarantee and retained volume.",
    levers: { investmentUsdM: 0, capacityIncreasePct: 4, dwellReductionPct: 8, tariffChangePct: -3 },
  },
  "dec-nsc-growth": {
    name: "North-South slot reallocation",
    objectRef: "object · corridor:durban-lusaka",
    description: "Capture corridor overflow with slot policy, minor works only.",
    levers: { investmentUsdM: 12, capacityIncreasePct: 8, dwellReductionPct: 5, tariffChangePct: 0 },
  },
  "dec-swell-window": {
    name: "Weather-resilient scheduling",
    objectRef: "object · port:durban",
    description: "Re-sequencing discipline plus forecast integration; dwell falls, no capex.",
    levers: { investmentUsdM: 1, capacityIncreasePct: 0, dwellReductionPct: 12, tariffChangePct: 0 },
  },
  "dec-lome-border": {
    name: "Cinkassé single-window scale-up",
    objectRef: "object · border:cinkasse",
    description: "Digitise the border post; dwell is the whole story.",
    levers: { investmentUsdM: 14, capacityIncreasePct: 0, dwellReductionPct: 35, tariffChangePct: 0 },
  },
  "dec-mombasa-berth": {
    name: "Mombasa deepening — tranche 2",
    objectRef: "object · project:mombasa-deepening",
    description: "The $86M capacity play with covenant-backed throughput.",
    levers: { investmentUsdM: 86, capacityIncreasePct: 24, dwellReductionPct: 6, tariffChangePct: 0 },
  },
  "dec-roo-datagap": {
    name: "e-Certificate onboarding wave 2",
    objectRef: "object · afcfta:digital-trade-protocol",
    description: "Verification coverage as trade facilitation — modest dwell effect.",
    levers: { investmentUsdM: 6, capacityIncreasePct: 0, dwellReductionPct: 9, tariffChangePct: 0 },
  },
};

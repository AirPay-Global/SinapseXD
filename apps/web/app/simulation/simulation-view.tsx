"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDecisions } from "@/components/decisions/decision-store";
import { SCENARIOS, simulate, type SimLevers } from "@/lib/simulation/model";

/**
 * Simulation Centre (UI Evolution spec, Priority 8). Pick a scenario (usually
 * arriving from a decision card's "Simulate"), pull the four levers, read the
 * modelled outputs — then log the run back onto the decision's activity
 * thread so the what-if becomes part of the decision record.
 */

function Lever({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-lg border border-border bg-background p-3">
      <span className="flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-card-foreground">{label}</span>
        <b className="font-mono text-[13px] tabular-nums text-foreground">{value}{unit}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--primary)]"
      />
    </label>
  );
}

function Out({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-heading text-[18px] font-extrabold tabular-nums ${tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="font-mono text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function SimulationView({ decisionId }: { decisionId?: string }) {
  const api = useDecisions();
  const scenarioKey = decisionId && SCENARIOS[decisionId] ? decisionId : "default";
  const [selectedKey, setSelectedKey] = useState(scenarioKey);
  const scenario = SCENARIOS[selectedKey];
  const [levers, setLevers] = useState<SimLevers>(scenario.levers);
  const [logged, setLogged] = useState(false);

  const out = useMemo(() => simulate(levers), [levers]);
  const decision = selectedKey !== "default" ? api.get(selectedKey) : undefined;

  const pickScenario = (key: string) => {
    setSelectedKey(key);
    setLevers(SCENARIOS[key].levers);
    setLogged(false);
  };

  const set = (k: keyof SimLevers) => (v: number) => {
    setLevers((prev) => ({ ...prev, [k]: v }));
    setLogged(false);
  };

  const logToDecision = () => {
    if (!decision) return;
    api.comment(
      decision.id,
      `Simulation run — ${scenario.name}: trade ${out.tradeGrowthPct > 0 ? "+" : ""}${out.tradeGrowthPct}% (≈$${out.tradeGrowthUsdM}M), GDP ≈$${out.gdpImpactUsdM}M, ${out.jobsCreated.toLocaleString("en-US")} jobs, carbon ${out.carbonKtPerYear}kt/yr, ROI ${out.roiPct === null ? "n/a" : `${out.roiPct}%`}.`,
    );
    setLogged(true);
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Scenario + levers */}
      <div className="flex flex-col gap-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Scenario</p>
          <select
            value={selectedKey}
            onChange={(e) => pickScenario(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-primary"
          >
            {Object.entries(SCENARIOS).map(([key, s]) => (
              <option key={key} value={key}>{s.name}</option>
            ))}
          </select>
          <p className="mt-2 text-[12px] text-muted-foreground">{scenario.description}</p>
          <p className="mt-1.5 font-mono text-[10.5px] text-muted-foreground">{scenario.objectRef}</p>
          {decision && (
            <Link href={`/decision/${decision.id}`} className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-primary hover:bg-muted">
              ← Decision: {decision.problem}
            </Link>
          )}
        </section>

        <section className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Levers</p>
          <Lever label="Investment" unit="M USD" min={0} max={200} step={1} value={levers.investmentUsdM} onChange={set("investmentUsdM")} />
          <Lever label="Capacity increase" unit="%" min={0} max={50} step={1} value={levers.capacityIncreasePct} onChange={set("capacityIncreasePct")} />
          <Lever label="Dwell / wait reduction" unit="%" min={0} max={60} step={1} value={levers.dwellReductionPct} onChange={set("dwellReductionPct")} />
          <Lever label="Tariff change" unit="%" min={-10} max={10} step={1} value={levers.tariffChangePct} onChange={set("tariffChangePct")} />
          <button
            onClick={() => { setLevers(scenario.levers); setLogged(false); }}
            className="self-start rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Reset to scenario
          </button>
        </section>
      </div>

      {/* Outputs */}
      <div className="flex flex-col gap-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Modelled outcomes · illustrative model, not a measurement</p>
            {decision && (
              <button
                onClick={logToDecision}
                disabled={logged}
                className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {logged ? "Logged to decision ✓" : "Log run to decision"}
              </button>
            )}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            <Out label="Investment required" value={`$${out.investmentUsdM}M`} />
            <Out label="Capacity increase" value={`+${out.capacityIncreasePct}%`} />
            <Out label="Trade growth" value={`${out.tradeGrowthPct > 0 ? "+" : ""}${out.tradeGrowthPct}%`} sub={`≈ $${out.tradeGrowthUsdM}M/yr on the corridor base`} tone={out.tradeGrowthPct > 0 ? "good" : out.tradeGrowthPct < 0 ? "bad" : undefined} />
            <Out label="GDP impact" value={`$${out.gdpImpactUsdM}M/yr`} tone={out.gdpImpactUsdM > 0 ? "good" : undefined} />
            <Out label="Jobs created" value={out.jobsCreated.toLocaleString("en-US")} sub="direct + indirect" />
            <Out label="Carbon impact" value={`${out.carbonKtPerYear > 0 ? "+" : ""}${out.carbonKtPerYear} kt/yr`} tone={out.carbonKtPerYear < 0 ? "good" : out.carbonKtPerYear > 0 ? "bad" : undefined} />
            <Out label="ROI (annualised)" value={out.roiPct === null ? "n/a" : `${out.roiPct}%`} sub={out.paybackYears ? `payback ≈ ${out.paybackYears} yrs` : "no capital deployed"} />
            <Out label="Agenda 2063" value={out.agenda2063.split("·")[0].trim()} sub={out.agenda2063.split("·")[1]?.trim()} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">SDGs advanced</p>
              <div className="flex flex-wrap gap-1.5">
                {out.sdgsAdvanced.length === 0 && <span className="text-[12px] text-muted-foreground">None at these settings.</span>}
                {out.sdgsAdvanced.map((s) => (
                  <span key={s} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px] text-card-foreground">{s}</span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Modelled risks</p>
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {out.risks.map((r) => (
                  <li key={r} className="text-[12px] leading-relaxed text-muted-foreground">{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-[12px] text-muted-foreground">
          <b className="text-foreground">Model card.</b> Transparent linear coefficients over a Durban–Lusaka-scale corridor base
          ($2.1B/yr): trade growth = 0.45×capacity + 0.30×dwell − 0.55×tariff; GDP = 32% of trade delta; jobs = 38/​$1M invested
          + 5.5/​$1M trade. Calibrated, evidence-linked simulation marts arrive with v2 Phase 5 — treat these numbers as a
          structured conversation, not a forecast.
        </p>
      </div>
    </div>
  );
}

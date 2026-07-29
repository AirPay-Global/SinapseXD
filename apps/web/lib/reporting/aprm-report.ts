import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createOntology } from "@/lib/ontology/sdk";
import { ANTHROPIC_MODEL } from "@/lib/ai/model";
import { sdgIndicators as demoSdgIndicators, corridorFlows as demoCorridorFlows } from "@/lib/demo-data";

/**
 * APRM (African Peer Review Mechanism) monitoring report generation
 * (CLAUDE.md §6.5 "APRM Reporting Exports", Design Bible AI feature "SDG
 * progress narratives for APRM reports"). Aggregates the same Gold marts the
 * dashboards already read — this is a reporting/export layer on top of
 * existing pillars, not a new data pillar.
 *
 * Every section is honestly tagged live/demo depending on whether the
 * underlying Gold mart actually returned rows (RLS with no authenticated
 * session, or an idle ingestor, both mean "demo" here — the report doesn't
 * distinguish why, only whether the number is real).
 */

export const DEMO_ORG_ID = "00000000-0000-0000-0000-00000000afcf";

const PILOT_COUNTRIES = ["ZAF", "KEN", "NGA", "TGO", "DJI", "TZA", "GHA", "ZMB", "UGA", "RWA", "ETH", "BFA", "MLI", "NER"];

const INDICATOR_META: Record<string, { label: string; target: number }> = {
  "8.1.1": { label: "GDP growth per capita (annual %)", target: 5.0 },
  "9.1.2": { label: "Freight volumes by mode of transport (index)", target: 100 },
  "10.1.1": { label: "Growth of income, bottom 40% (%)", target: 4.5 },
  "17.1.1": { label: "Government revenue as % of GDP", target: 20 },
};

export interface AprmSdgSection {
  goal: 8 | 9 | 10 | 17;
  indicatorCode: string;
  label: string;
  value: number;
  target: number;
  countriesReporting: number;
  live: boolean;
}

export interface AprmCorridorSection {
  corridorId: string;
  corridorName: string;
  gatewayPortCalls30d: number | null;
  gatewayThroughputTons30d: number | null;
  tradeValueUsdLatest: number | null;
  tradeValuePeriod: string | null;
  live: boolean;
  tradeLive: boolean;
}

export interface AprmReportContent {
  period: string;
  generatedAt: string;
  sdg: AprmSdgSection[];
  corridors: AprmCorridorSection[];
  narrative: string;
  narrativeLive: boolean;
  methodology: string[];
}

async function buildSdgSections(): Promise<AprmSdgSection[]> {
  const onto = await createOntology();
  const perCountry = await Promise.all(PILOT_COUNTRIES.map((iso3) => onto.countries.sdgIndicators(iso3)));
  const liveRows = perCountry.flatMap((r) => r.data);

  if (liveRows.length === 0) {
    const demo = demoSdgIndicators();
    const byGoal = new Map<string, { goal: number; label: string; sum: number; count: number }>();
    for (const row of demo) {
      const key = row.indicatorCode;
      const cur = byGoal.get(key) ?? { goal: row.goal, label: row.label, sum: 0, count: 0 };
      cur.sum += row.value;
      cur.count += 1;
      byGoal.set(key, cur);
    }
    return [...byGoal.entries()].map(([code, { goal, label, sum, count }]) => ({
      goal: goal as 8 | 9 | 10 | 17,
      indicatorCode: code,
      label,
      value: sum / count,
      target: INDICATOR_META[code]?.target ?? 100,
      countriesReporting: 0,
      live: false,
    }));
  }

  const byIndicator = new Map<string, { goal: number; sum: number; count: number }>();
  for (const row of liveRows) {
    const cur = byIndicator.get(row.indicator_code) ?? { goal: row.goal, sum: 0, count: 0 };
    cur.sum += row.value;
    cur.count += 1;
    byIndicator.set(row.indicator_code, cur);
  }
  return [...byIndicator.entries()].map(([code, { goal, sum, count }]) => ({
    goal: goal as 8 | 9 | 10 | 17,
    indicatorCode: code,
    label: INDICATOR_META[code]?.label ?? code,
    value: sum / count,
    target: INDICATOR_META[code]?.target ?? 100,
    countriesReporting: count,
    live: true,
  }));
}

async function buildCorridorSections(): Promise<AprmCorridorSection[]> {
  const onto = await createOntology();
  const [corridors, gateway, tradeFlows] = await Promise.all([
    onto.corridors.list(),
    onto.corridors.gatewayActivity(),
    onto.corridors.tradeFlows(),
  ]);

  if (corridors.length === 0) {
    return demoCorridorFlows().map((f) => ({
      corridorId: f.corridor,
      corridorName: f.corridor,
      gatewayPortCalls30d: null,
      gatewayThroughputTons30d: null,
      tradeValueUsdLatest: f.tradeValueUsd,
      tradeValuePeriod: null,
      live: false,
      tradeLive: false,
    }));
  }

  return corridors.map((c) => {
    const gw = gateway.data.find((g) => g.corridor_id === c.id);
    const trade = tradeFlows.data.find((t) => t.corridor_id === c.id);
    return {
      corridorId: c.id,
      corridorName: c.name,
      gatewayPortCalls30d: gw?.port_calls_30d ?? null,
      gatewayThroughputTons30d: gw?.throughput_tons_30d ?? null,
      tradeValueUsdLatest: trade?.trade_value_usd_latest ?? null,
      tradeValuePeriod: trade?.latest_period ?? null,
      live: gw !== undefined,
      tradeLive: trade !== undefined,
    };
  });
}

async function buildNarrative(period: string, sdg: AprmSdgSection[], corridors: AprmCorridorSection[]): Promise<{ text: string; live: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY;
  const liveCorridors = corridors.filter((c) => c.live).length;
  const fallback =
    `This ${period} monitoring summary covers ${sdg.length} SDG 8/9/10/17 indicators and ${corridors.length} AfCFTA pilot corridors. ` +
    `${liveCorridors} of ${corridors.length} corridors report live gateway activity; the remainder show illustrative figures pending live data. ` +
    `Treat all values against their live/demo tag in the sections below — this narrative does not distinguish provenance beyond that flag.`;
  if (!key) return { text: fallback, live: false };

  const facts = [
    `Period: ${period}.`,
    ...sdg.map((s) => `SDG ${s.goal} (${s.indicatorCode} ${s.label}): ${s.value.toFixed(1)} vs target ${s.target} — ${s.live ? `live, averaged across ${s.countriesReporting} countries` : "demo/illustrative"}.`),
    ...corridors.map((c) =>
      `Corridor ${c.corridorName}: gateway port calls (30d) ${c.gatewayPortCalls30d ?? "n/a"}, throughput (30d) ${c.gatewayThroughputTons30d ? Math.round(c.gatewayThroughputTons30d) + "t" : "n/a"}, bilateral trade value ${c.tradeValueUsdLatest ? "$" + (c.tradeValueUsdLatest / 1e6).toFixed(1) + "M" : "n/a"} — ${c.live ? "live" : "demo/illustrative"}.`,
    ),
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system:
        "You are Sinapse XD's APRM (African Peer Review Mechanism) reporting analyst. Write a concise (4-6 sentence) monitoring narrative for an AfCFTA/APRM audience, covering SDG progress and corridor performance. Only use the facts given — never invent a number. When a fact is tagged demo/illustrative, say so plainly rather than presenting it as verified. End with one recommended monitoring priority for next period.",
      messages: [{ role: "user", content: `Report data:\n${facts}\n\nWrite the narrative.` }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text ? { text, live: true } : { text: fallback, live: false };
  } catch (err) {
    console.error("APRM narrative generation failed", err);
    return { text: fallback, live: false };
  }
}

export async function generateAprmReport(period: string): Promise<AprmReportContent> {
  const [sdg, corridors] = await Promise.all([buildSdgSections(), buildCorridorSections()]);
  const narrative = await buildNarrative(period, sdg, corridors);
  return {
    period,
    generatedAt: new Date().toISOString(),
    sdg,
    corridors,
    narrative: narrative.text,
    narrativeLive: narrative.live,
    methodology: [
      "SDG 8/9/10/17 values are averaged across pilot AfCFTA countries with a live UN SDG API reading for that indicator; 2030 targets are illustrative reference points, not part of any API response.",
      "Corridor gateway activity is the coastal gateway port's 30-day IMF PortWatch throughput attributed to the corridor — a proxy for corridor activity, not verified end-to-end flow (Customs/Rail data products are deferred).",
      "Bilateral trade value is UN Comtrade's reported country-to-country export+import value for the corridor's two countries, not physical corridor volume.",
      "Sections marked \"demo\" reflect illustrative figures shown when the live pipeline has no data yet (idle ingestor, or no authenticated read access) — they are never presented as verified.",
    ],
  };
}

export async function saveAprmReport(orgId: string, content: AprmReportContent): Promise<string | null> {
  let supabase: ReturnType<typeof createClient> | null = null;
  try {
    supabase = createClient(await cookies());
  } catch {
    supabase = null;
  }
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("aprm_reports")
      .upsert(
        {
          org_id: orgId,
          period: content.period,
          title: `APRM Monitoring Summary — ${content.period}`,
          status: "generated",
          content_json: content,
          generated_at: content.generatedAt,
        },
        { onConflict: "org_id,period" },
      )
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

export interface AprmReportRow {
  id: string;
  period: string;
  title: string | null;
  status: string;
  generated_at: string;
  content_json: AprmReportContent;
}

export async function listAprmReports(orgId: string): Promise<AprmReportRow[]> {
  let supabase: ReturnType<typeof createClient> | null = null;
  try {
    supabase = createClient(await cookies());
  } catch {
    supabase = null;
  }
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("aprm_reports")
      .select("id, period, title, status, generated_at, content_json")
      .eq("org_id", orgId)
      .order("generated_at", { ascending: false });
    if (error || !data) return [];
    return data as AprmReportRow[];
  } catch {
    return [];
  }
}

export async function getAprmReport(id: string): Promise<AprmReportRow | null> {
  let supabase: ReturnType<typeof createClient> | null = null;
  try {
    supabase = createClient(await cookies());
  } catch {
    supabase = null;
  }
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("aprm_reports")
      .select("id, period, title, status, generated_at, content_json")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data as AprmReportRow;
  } catch {
    return null;
  }
}

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

/**
 * AI Briefings — Claude-powered corridor analyst (Design Bible §10, CLAUDE.md
 * §6.3 `corridor_analyst.py`). Implemented here rather than as a separate
 * Python worker: it's triggered by a corridor profile page render and cached
 * one-per-corridor-per-day in `ai_briefings`, so there's no batch job to
 * schedule — the cache IS the rate limit (at most 7 corridors × 1 Claude
 * call/day, regardless of view traffic).
 *
 * Degrades to null (never throws) when Supabase or ANTHROPIC_API_KEY isn't
 * configured — the caller falls back to the existing static summary.
 */

export interface CorridorBriefingInput {
  corridorId: string;
  corridorName: string;
  originPortName: string;
  destinationName: string;
  countries: string[];
  gatewayPortCalls30d: number | null;
  gatewayThroughputTons30d: number | null;
  tradeValueUsdLatest: number | null;
  tradeValuePeriod: string | null;
}

export async function getCorridorBriefing(input: CorridorBriefingInput): Promise<string | null> {
  let supabase: ReturnType<typeof createClient> | null = null;
  try {
    supabase = createClient(await cookies());
  } catch {
    supabase = null;
  }
  if (!supabase) return null;

  const today = new Date().toISOString().slice(0, 10);

  try {
    const { data: cached } = await supabase
      .from("ai_briefings")
      .select("content")
      .eq("corridor_id", input.corridorId)
      .eq("briefing_date", today)
      .maybeSingle();
    if (cached?.content) return cached.content as string;
  } catch {
    return null;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const facts = [
    `Corridor: ${input.corridorName} (${input.originPortName} → ${input.destinationName}), countries: ${input.countries.join(", ")}.`,
    input.gatewayPortCalls30d !== null
      ? `Gateway port calls, last 30 days: ${input.gatewayPortCalls30d} (IMF PortWatch, live).`
      : "Gateway port calls: no live data yet (demo).",
    input.gatewayThroughputTons30d !== null
      ? `Gateway throughput, last 30 days: ${Math.round(input.gatewayThroughputTons30d)} tonnes (IMF PortWatch, live). Note: this is the gateway port's total throughput, not verified end-to-end corridor volume.`
      : "Gateway throughput: no live data yet (demo).",
    input.tradeValueUsdLatest !== null
      ? `Bilateral trade value between the two countries, ${input.tradeValuePeriod}: $${(input.tradeValueUsdLatest / 1e6).toFixed(1)}M (UN Comtrade, live).`
      : "Bilateral trade value: no live data yet (demo).",
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system:
        "You are Sinapse XD's corridor intelligence analyst. Write a concise (3-4 sentence) briefing for a port operator or government official. Only use the facts given — never invent a number. If a fact says data isn't live yet, say so plainly instead of guessing. End with one concrete, actionable recommendation.",
      messages: [{ role: "user", content: `Corridor data:\n${facts}\n\nWrite the briefing.` }],
    });
    const content = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!content) return null;

    await supabase.from("ai_briefings").upsert(
      {
        corridor_id: input.corridorId,
        briefing_date: today,
        model: "claude-sonnet-4-5",
        content,
        tokens_used: response.usage.input_tokens + response.usage.output_tokens,
      },
      { onConflict: "corridor_id,briefing_date" },
    );
    return content;
  } catch (err) {
    console.error("Corridor briefing generation failed", err);
    return null;
  }
}

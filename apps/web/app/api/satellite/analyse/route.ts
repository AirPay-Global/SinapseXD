import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Satellite AI Advisor (spec §6). Analyses the active map state and returns a
 * strictly structured response: what is visible vs what was inferred vs what
 * changed, why it matters, alternative explanations, data limitations,
 * confidence, and a recommended next step. The structure is the whole point —
 * it forces the model to separate observation from inference (spec §14).
 *
 * Grounded: the request sends the current port, active layers, and a summary
 * of the berths/vessels on screen; the model must not invent detail beyond
 * that. Degrades honestly (a templated structured response, live:false) when
 * ANTHROPIC_API_KEY isn't set. Rate limited — it calls a paid model.
 */

export const runtime = "nodejs";

const SYSTEM = `You are the Satellite Intelligence Advisor inside Sinapse XDi, a maritime observation platform for African ports.

You analyse AIS and earth-observation data. Follow these rules without exception:
- Separate DIRECT OBSERVATION (seen in AIS/imagery) from MACHINE INFERENCE (clustering, occupancy models) from PREDICTION. Never blur them.
- Never call something a "dark vessel", "spoofing", or "confirmed berth" without noting it needs authorised human review.
- Only use the facts in CONTEXT. Do not invent vessel names, berth counts, or imagery you weren't given.
- The current pipeline is demo/AIS-only: there is no live optical or radar imagery yet. Say so plainly if asked about imagery.

Respond as strict JSON matching this shape (no markdown, no prose outside JSON):
{"visible": "...", "inferred": "...", "changed": "...", "matters": "...", "alternatives": "...", "limitations": ["...","..."], "confidence": "High|Medium|Low", "nextStep": "..."}`;

function templated(ctx: string): Record<string, unknown> {
  return {
    visible: "AIS vessel tracks and current positions for the selected port, plus the known-berth and candidate-berth layers. (Advisor not connected — ANTHROPIC_API_KEY is not set in this environment.)",
    inferred: "Candidate berths are machine-inferred from clustered low-speed AIS events with a heading-variation filter; occupancy is inferred from arrival/departure events. None are port-verified.",
    changed: "No before/after imagery comparison is available — optical and radar layers are planned, not live.",
    matters: "Inferred berths and occupancy help spot under-used capacity and congestion, but must be validated before operational or investment use.",
    alternatives: "A stationary cluster can be congestion or an anchorage rather than a berth; a missing AIS signal can be a receiver gap rather than anything untoward.",
    limitations: ["AIS-only, no imagery confirmation yet", "Demo geometry, not a live satellite basemap", "Candidate berths need analyst + port review"],
    confidence: "Low",
    nextStep: "Add historical AIS and request port validation before promoting any candidate berth.",
    _context: ctx.slice(0, 0), // keep param referenced without leaking
  };
}

export async function POST(req: Request) {
  const rate = await checkRateLimit("satellite-analyse", clientIp(req), { limit: 12, windowSeconds: 60 });
  if (!rate.success) {
    return NextResponse.json({ error: "Too many analyses — wait a moment and try again." }, { status: 429 });
  }

  let body: { context?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const context = (body.context ?? "").slice(0, 4000);
  const question = (body.question ?? "Analyse the current map state.").slice(0, 500);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ analysis: { ...templated(context), live: false } });
  }

  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: "user", content: `CONTEXT:\n${context}\n\nQUESTION: ${question}` }],
    });
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text.replace(/^```json?/i, "").replace(/```$/, "").trim());
    } catch {
      parsed = null;
    }
    if (!parsed) return NextResponse.json({ analysis: { ...templated(context), live: false } });
    return NextResponse.json({ analysis: { ...parsed, live: true } });
  } catch (err) {
    console.error("Satellite analyse failed", err);
    return NextResponse.json({ analysis: { ...templated(context), live: false } });
  }
}

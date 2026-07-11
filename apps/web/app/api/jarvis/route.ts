import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createOntology } from "@/lib/ontology/sdk";

/**
 * AI Jarvis — the platform's decision copilot (Design Bible §10 "AI
 * Copilot"). Server route so the Anthropic key never reaches the client.
 * Grounds every answer in a live snapshot of the ontology + pillar status so
 * Jarvis never invents numbers the platform doesn't actually have — when a
 * pillar is demo/idle, the system prompt says so and Jarvis says so too.
 */

export const runtime = "nodejs";

const SYSTEM_PREAMBLE = `You are AI Jarvis, the decision copilot for Sinapse XD — a trade intelligence platform for African ports, governments, DFIs, and AfCFTA institutions, built by AirPay Global Inc.

Ground rules:
- Only speak to the data pillars and objects described in the CONTEXT block below. Never invent a specific number, vessel, or figure that isn't given to you.
- If asked about a pillar marked "idle" or "demo", say plainly that it isn't live yet rather than fabricating a value.
- Be concise — 2-4 sentences unless the user asks for detail. This is a decision copilot, not a report generator.
- When relevant, end with a one-line recommendation or next question the user should ask.`;

async function buildContext(): Promise<string> {
  const onto = await createOntology();
  const [ports, corridors, countries] = await Promise.all([
    onto.ports.list(),
    onto.corridors.list(),
    onto.countries.list(),
  ]);
  const objectLine = ports.length
    ? `Ontology (live): ${ports.length} ports, ${corridors.length} corridors, ${countries.length} countries.`
    : `Ontology (seed/demo, DB unreachable): 7 pilot ports (Durban, Mombasa, Lagos, Lomé, Djibouti, Dar es Salaam, Tema), 7 corridors, 14 countries.`;

  return [
    objectLine,
    "Pillar status:",
    "- Port Activity (IMF PortWatch): LIVE — no key needed.",
    "- AIS & Vessels (AISHub): wired, idle until AISHUB_USERNAME is set — dashboards show demo data.",
    "- Trade Analytics (UN Comtrade): wired, idle until UN_COMTRADE_API_KEY is set — dashboards show demo data.",
    "- Weather & Marine (Open-Meteo): wired, idle until the worker is deployed — dashboards show demo data.",
    "- Market Intel, Financial Data, SDG Reporting: not yet built (stubs).",
    "- Sinapse CRM: deliberately deferred, out of scope for this build.",
  ].join("\n");
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  let body: { message?: string; history?: Array<{ role: "user" | "assistant"; content: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  if (!key) {
    return NextResponse.json({
      reply:
        "Jarvis isn't live yet — ANTHROPIC_API_KEY isn't set in this environment, so I can't reach Claude. Once it's added to the Render environment group, I'll answer using the platform's live ontology and pillar data.",
      status: "demo",
    });
  }

  try {
    const context = await buildContext();
    const client = new Anthropic({ apiKey: key });
    const history = (body.history ?? []).slice(-8); // keep the request small
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      system: `${SYSTEM_PREAMBLE}\n\nCONTEXT:\n${context}`,
      messages: [...history, { role: "user" as const, content: message }],
    });
    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return NextResponse.json({ reply, status: "live" });
  } catch (err) {
    console.error("Jarvis request failed", err);
    return NextResponse.json(
      { reply: "Jarvis hit an error reaching Claude — try again in a moment.", status: "down" },
      { status: 200 },
    );
  }
}

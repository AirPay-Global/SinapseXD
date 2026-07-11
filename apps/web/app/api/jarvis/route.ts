import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getAdvisor } from "@/lib/ai/advisors";
import { createOntology } from "@/lib/ontology/sdk";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

/**
 * AI advisors — the platform's specialist copilots (UI Evolution spec,
 * Priority 2). One route serves the whole bench: the request names an advisor
 * and the current stakeholder, and the system prompt composes the shared
 * grounding rules with that advisor's domain lens. Server route so the
 * Anthropic key never reaches the client. Grounds every answer in a live
 * snapshot of the ontology + pillar status so advisors never invent numbers
 * the platform doesn't actually have.
 */

export const runtime = "nodejs";

const SYSTEM_PREAMBLE = `You are a specialist AI advisor inside Sinapse XD — a trade intelligence platform for African ports, governments, DFIs, and AfCFTA institutions, built by AirPay Global Inc.

Ground rules:
- Only speak to the data pillars and objects described in the CONTEXT block below. Never invent a specific number, vessel, or figure that isn't given to you.
- If asked about a pillar marked "idle" or "demo", say plainly that it isn't live yet rather than fabricating a value.
- Be concise — 2-4 sentences unless the user asks for detail. This is a decision copilot, not a report generator.
- Stay inside your domain lens; if the question belongs to another advisor, answer briefly and name the better-suited advisor.
- When relevant, end with a one-line recommendation or next question the user should ask.`;

interface StakeholderContext {
  stakeholder?: string;
  name?: string;
  org?: string;
  country?: string;
  port?: string | null;
  objectives?: string;
}

function stakeholderBlock(c: StakeholderContext | undefined): string {
  if (!c) return "";
  const lines = [
    "Current stakeholder:",
    c.name && c.org ? `- User: ${c.name} at ${c.org}` : null,
    c.stakeholder ? `- Command centre: ${c.stakeholder}` : null,
    c.country ? `- Country focus: ${c.country}` : null,
    c.port ? `- Home port: ${c.port}` : null,
    c.objectives ? `- Objectives: ${c.objectives}` : null,
  ].filter(Boolean);
  return lines.length > 1 ? lines.join("\n") : "";
}

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

// Jarvis calls a paid, latency-bearing model per request — tighter than a
// typical read endpoint. 10 requests/minute is generous for one human
// chatting, not for a script.
const RATE_LIMIT = { limit: 10, windowSeconds: 60 };

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rate = await checkRateLimit("jarvis", ip, RATE_LIMIT);
  if (!rate.success) {
    return NextResponse.json(
      { reply: "You're sending messages faster than Jarvis can keep up — please wait a moment and try again.", status: "limited" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": String(rate.remaining),
          "Retry-After": String(Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000))),
        },
      },
    );
  }

  const key = process.env.ANTHROPIC_API_KEY;
  let body: {
    message?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    advisor?: string;
    context?: StakeholderContext;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  const advisor = getAdvisor(body.advisor);

  if (!key) {
    return NextResponse.json({
      reply: `The ${advisor.name} isn't live yet — ANTHROPIC_API_KEY isn't set in this environment, so I can't reach Claude. Once it's added to the Render environment group, I'll answer using the platform's live ontology and pillar data.`,
      status: "demo",
    });
  }

  try {
    const context = await buildContext();
    const client = new Anthropic({ apiKey: key });
    const history = (body.history ?? []).slice(-8); // keep the request small
    const system = [
      SYSTEM_PREAMBLE,
      `YOUR DOMAIN LENS:\n${advisor.focus}`,
      stakeholderBlock(body.context),
      `CONTEXT:\n${context}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      system,
      messages: [...history, { role: "user" as const, content: message }],
    });
    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return NextResponse.json({ reply, status: "live" });
  } catch (err) {
    console.error("Advisor request failed", err);
    return NextResponse.json(
      { reply: `The ${advisor.name} hit an error reaching Claude — try again in a moment.`, status: "down" },
      { status: 200 },
    );
  }
}

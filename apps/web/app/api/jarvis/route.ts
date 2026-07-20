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
- The CONTEXT includes a "Live snapshot" with real current figures — use those directly when they answer the question instead of asking the user to paste dashboard numbers back to you. Only ask the user for a number if it genuinely isn't in CONTEXT.
- If asked about a pillar marked "idle" or "demo", or a metric CONTEXT explicitly says has no live source (e.g. anchorage wait, berth occupancy %), say plainly that it isn't live yet rather than fabricating a value.
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

/**
 * Pillar status is checked against real data on every request — not
 * hardcoded — precisely so Jarvis can't tell a stale story once a worker
 * gets deployed or a key gets set. One representative Gold-mart read per
 * pillar (Durban / ZAF / the Durban-Lusaka corridor / the global freight
 * index) is a cheap, honest proxy for "is this pillar actually live."
 */
async function pillarStatusLines(onto: Awaited<ReturnType<typeof createOntology>>): Promise<string[]> {
  const [portActivity, conditions, vessels, trade, freight, sdg, econ] = await Promise.all([
    onto.ports.activity30d("durban"),
    onto.ports.conditions("durban"),
    onto.ports.vesselsNear("durban"),
    onto.corridors.tradeFlows(),
    onto.market.freightIndex(),
    onto.countries.sdgIndicators("ZAF"),
    onto.countries.economicIndicators("ZAF"),
  ]);
  const line = (label: string, live: boolean, idleHint: string) =>
    `- ${label}: ${live ? "LIVE" : `wired, idle — ${idleHint}`} — dashboards show ${live ? "real" : "demo"} data.`;

  const lines = [
    line("Port Activity (IMF PortWatch)", portActivity.data !== null, "no key needed, check the worker is deployed"),
    line("Weather & Marine (Open-Meteo)", conditions.data !== null, "no key needed, check the worker is deployed"),
    line("Financial Data (World Bank)", econ.data.length > 0, "no key needed, check the worker is deployed"),
    line("SDG Reporting (UN SDG API)", sdg.data.length > 0, "no key needed, check the worker is deployed"),
    line("Trade Analytics (UN Comtrade)", trade.data.length > 0, "needs UN_COMTRADE_API_KEY"),
    line("Market Intel (Freightos)", freight.data !== null, "needs FREIGHTOS_API_KEY"),
    "- AIS & Vessels (AISHub): needs AISHUB_USERNAME (a reciprocal key) — dashboards show demo data until then.",
    "- Sinapse CRM: deliberately deferred, out of scope for this build.",
  ];

  // A pillar being "LIVE" only means the underlying feed is real — it does
  // NOT mean every number a user might ask for exists. Hand over the actual
  // figures for Durban so the advisor can answer directly instead of asking
  // the user to paste dashboard numbers back, and say plainly which
  // operational metrics have no live source at all (no fabricating those
  // either, in the other direction).
  const snapshot: string[] = ["Live snapshot — Port of Durban:"];
  snapshot.push(
    portActivity.data
      ? `- Port calls (30d): ${portActivity.data.port_calls_30d} · Import ${Math.round(portActivity.data.import_tons_30d)}t · Export ${Math.round(portActivity.data.export_tons_30d)}t (IMF PortWatch, live, as of ${portActivity.data.as_of}).`
      : "- Port calls / throughput: no live reading right now (demo data on the dashboard).",
  );
  snapshot.push(
    conditions.data
      ? `- Marine conditions: wave ${conditions.data.wave_height_m}m, wind ${conditions.data.wind_speed_kn}kn, disruption risk "${conditions.data.disruption_risk ?? "unknown"}" (Open-Meteo, live, ${conditions.data.ts}).`
      : "- Marine conditions: no live reading right now (demo data on the dashboard).",
  );
  snapshot.push(
    vessels.data.length > 0
      ? `- Vessels with a live AIS position destined for Durban right now: ${vessels.data.length}.`
      : "- Live AIS vessel count: none reporting Durban as destination right now (AIS is idle without AISHUB_USERNAME — the dashboard's vessel queue is demo data).",
  );
  snapshot.push(
    "- Anchorage wait time and berth occupancy %: NOT available from any live source in this platform yet (no congestion mart exists). Any figure for these on a dashboard is illustrative demo data — never state a specific wait-time or occupancy number as real.",
  );

  return [...lines, ...snapshot];
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

  const pillars = await pillarStatusLines(onto);
  return [objectLine, "Pillar status (checked live, not hardcoded):", ...pillars].join("\n");
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
      model: "claude-sonnet-5",
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

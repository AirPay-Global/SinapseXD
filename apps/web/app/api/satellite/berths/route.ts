import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Berth review actions (spec §16, §4.2). Persists the candidate→reviewed→
 * verified/rejected transition to satellite_berths when Supabase is reachable;
 * otherwise reports persisted:false so the client keeps session-only overlay
 * state and says so, instead of pretending the review was saved. The state
 * machine (no jump straight to port_verified) is enforced client-side in the
 * berth store and echoed here.
 */

export const runtime = "nodejs";

const ACTION_TO_STATE: Record<string, string> = {
  review: "analyst_reviewed",
  verify: "port_verified",
  reject: "rejected",
};

export async function POST(req: Request) {
  const rate = await checkRateLimit("satellite-berths", clientIp(req), { limit: 40, windowSeconds: 60 });
  if (!rate.success) return NextResponse.json({ error: "Too many berth updates — slow down." }, { status: 429 });

  let body: { id?: string; portId?: string; name?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const id = (body.id ?? "").trim();
  const state = ACTION_TO_STATE[(body.action ?? "").trim()];
  if (!id || !state) {
    return NextResponse.json({ error: `id and a valid action (${Object.keys(ACTION_TO_STATE).join("|")}) are required` }, { status: 400 });
  }

  let supabase: ReturnType<typeof createClient> | null = null;
  try {
    supabase = createClient(await cookies());
  } catch {
    supabase = null;
  }
  if (!supabase) return NextResponse.json({ persisted: false, state });

  try {
    const { error } = await supabase.from("satellite_berths").upsert({
      id,
      port_id: body.portId ?? null,
      name: body.name ?? id,
      state,
      review_note: body.note ?? null,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ persisted: !error, state });
  } catch {
    return NextResponse.json({ persisted: false, state });
  }
}

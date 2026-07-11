import { NextResponse } from "next/server";
import { DEMO_ORG_ID, generateAprmReport, listAprmReports, saveAprmReport } from "@/lib/reporting/aprm-report";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Report generation can call Claude for the narrative — same cost profile as
// Jarvis, tighter than a typical read endpoint.
const RATE_LIMIT = { limit: 6, windowSeconds: 60 };

const PERIOD_RE = /^\d{4}-(Q[1-4]|H[12]|[01]\d)$/;

export async function GET() {
  const reports = await listAprmReports(DEMO_ORG_ID);
  return NextResponse.json({ reports });
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rate = await checkRateLimit("aprm-report", ip, RATE_LIMIT);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Too many report generations — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000))) } },
    );
  }

  let body: { period?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const period = (body.period ?? "").trim();
  if (!PERIOD_RE.test(period)) {
    return NextResponse.json({ error: "Period must look like 2026-Q3, 2026-H1, or 2026-07" }, { status: 400 });
  }

  const content = await generateAprmReport(period);
  const id = await saveAprmReport(DEMO_ORG_ID, content);
  if (!id) {
    return NextResponse.json(
      { error: "Couldn't save the report — Supabase isn't reachable in this environment. The generated content is included below for inspection.", content },
      { status: 200 },
    );
  }
  return NextResponse.json({ id, content });
}

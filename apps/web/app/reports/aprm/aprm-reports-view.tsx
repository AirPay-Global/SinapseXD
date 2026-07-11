"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ReportSummary {
  id: string;
  period: string;
  title: string | null;
  status: string;
  generatedAt: string;
}

function defaultPeriod(): string {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${q}`;
}

export function AprmReportsView({ initialReports }: { initialReports: ReportSummary[] }) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [period, setPeriod] = useState(defaultPeriod());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/aprm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Report generation failed.");
        return;
      }
      if (!data.id) {
        setError(data.error ?? "Report generated but couldn't be saved.");
        return;
      }
      router.push(`/reports/aprm/${data.id}`);
    } catch {
      setError("Couldn't reach the report service — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-heading text-[15px] font-semibold text-foreground">Generate a new report</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Aggregates the same live SDG, corridor, and trade data the dashboards read, plus an AI-written monitoring narrative. Generating the same period again replaces it rather than duplicating.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="2026-Q3"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none"
          />
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {loading ? "Generating…" : "Generate report"}
          </button>
          <span className="font-mono text-[10.5px] text-muted-foreground">Format: 2026-Q3 · 2026-H1 · 2026-07</span>
        </div>
        {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <p className="border-b border-border px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Generated reports
        </p>
        {reports.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-muted-foreground">No reports generated yet — create one above.</p>
        ) : (
          <div className="divide-y divide-border">
            {reports.map((r) => (
              <Link key={r.id} href={`/reports/aprm/${r.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted">
                <div>
                  <p className="text-[13.5px] font-medium text-foreground">{r.title ?? r.period}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(r.generatedAt).toLocaleString()}</p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">{r.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

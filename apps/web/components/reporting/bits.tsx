"use client";

import { FRAMEWORK_LABEL, STATUS_META, TONE_VAR, type Framework, type ReportStatus } from "@/lib/reporting/model";

/** Shared reporting UI atoms. */

export function StatusBadge({ status, short = false }: { status: ReportStatus; short?: boolean }) {
  const m = STATUS_META[status];
  const v = TONE_VAR[m.tone];
  const neutral = m.tone === "neutral" || m.tone === "muted";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wide"
      style={{ color: neutral ? "var(--muted-foreground)" : v, background: neutral ? "var(--muted)" : `color-mix(in srgb, ${v} 13%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: neutral ? "var(--muted-foreground)" : v }} aria-hidden />
      {short ? m.short : m.label}
    </span>
  );
}

export function FrameworkChip({ framework }: { framework: Framework }) {
  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{FRAMEWORK_LABEL[framework]}</span>
  );
}

export function DataStatusDot({ status }: { status: "live" | "demo" | "planned" }) {
  const v = status === "live" ? "var(--success)" : status === "demo" ? "var(--warning)" : "var(--muted-foreground)";
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wide" style={{ color: v }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: v }} aria-hidden />
      {status}
    </span>
  );
}

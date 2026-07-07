import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  subtitle,
  delta,
}: {
  label: string;
  value: string;
  subtitle?: string;
  delta?: { text: string; direction: "up" | "down"; positive: boolean };
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-4xl font-bold font-heading text-card-foreground">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta && (
          <span
            className={delta.positive ? "font-semibold text-success" : "font-semibold text-destructive"}
          >
            {delta.direction === "up" ? "▲" : "▼"} {delta.text}
          </span>
        )}
        {subtitle && <span className="text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  pillar,
  children,
}: {
  title: string;
  subtitle?: string;
  pillar?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-base font-semibold text-card-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {pillar && (
          <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {pillar}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";
import type { PillarFeed } from "@sinapse/shared";
import { feedLabel } from "@/lib/feed";
import { Skeleton, SkeletonChart } from "@/components/ui/skeleton";

type Delta = { text: string; direction: "up" | "down"; positive: boolean };

// ── Feed freshness stamp ────────────────────────────────
const FEED_DOT: Record<PillarFeed["status"], string> = {
  live: "bg-success",
  loading: "bg-muted-foreground",
  stale: "bg-warning",
  down: "bg-destructive",
  demo: "bg-warning",
};

export function FeedStamp({ feed }: { feed: PillarFeed }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${FEED_DOT[feed.status]} ${
          feed.status === "loading" ? "animate-pulse" : ""
        }`}
        aria-hidden
      />
      {feedLabel(feed)}
    </span>
  );
}

// ── Empty state (feed down) ─────────────────────────────
export function NoFeed({ pillar, height }: { pillar?: string; height?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-center"
      style={{ minHeight: height ?? 160 }}
    >
      <p className="text-sm font-medium text-card-foreground">No data yet</p>
      <p className="max-w-[28ch] text-xs text-muted-foreground">
        {pillar ? `The ${pillar} feed hasn’t delivered yet.` : "This feed hasn’t delivered yet."}{" "}
        Waiting on the next ingestion.
      </p>
    </div>
  );
}

// ── KPI stat card ───────────────────────────────────────
export function StatCard({
  label,
  value,
  subtitle,
  delta,
  feed,
  loading = false,
}: {
  label: string;
  value: string;
  subtitle?: string;
  delta?: Delta;
  feed?: PillarFeed;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {feed && <FeedStamp feed={feed} />}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-2 h-9 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
        </>
      ) : (
        <>
          <p className="mt-2 text-4xl font-bold font-heading text-card-foreground">{value}</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {delta && (
              <span
                className={
                  delta.positive
                    ? "font-semibold text-success"
                    : "font-semibold text-destructive"
                }
              >
                {delta.direction === "up" ? "▲" : "▼"} {delta.text}
              </span>
            )}
            {subtitle && <span className="text-muted-foreground">{subtitle}</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ── Hero stat — the one headline metric for the view ────
export function HeroStat({
  label,
  value,
  unit,
  delta,
  context,
  feed,
  loading = false,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: Delta;
  context?: string;
  feed?: PillarFeed;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {feed && <FeedStamp feed={feed} />}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-14 w-48" />
      ) : (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-heading text-6xl font-bold leading-none text-card-foreground">
            {value}
          </span>
          {unit && <span className="text-xl font-semibold text-muted-foreground">{unit}</span>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {delta && !loading && (
          <span
            className={
              delta.positive ? "font-semibold text-success" : "font-semibold text-destructive"
            }
          >
            {delta.direction === "up" ? "▲" : "▼"} {delta.text}
          </span>
        )}
        {context && <span className="text-muted-foreground">{context}</span>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ── Chart / panel card with feed state ──────────────────
export function ChartCard({
  title,
  subtitle,
  pillar,
  feed,
  children,
  bodyHeight = 280,
}: {
  title: string;
  subtitle?: string;
  pillar?: string;
  feed?: PillarFeed;
  children: ReactNode;
  bodyHeight?: number;
}) {
  const loading = feed?.status === "loading";
  const down = feed?.status === "down";
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-base font-semibold text-card-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          {feed && (
            <div className="mt-1.5">
              <FeedStamp feed={feed} />
            </div>
          )}
        </div>
        {pillar && (
          <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {pillar}
          </span>
        )}
      </div>
      {loading ? (
        <SkeletonChart height={bodyHeight} />
      ) : down ? (
        <NoFeed pillar={pillar} height={bodyHeight} />
      ) : (
        children
      )}
    </div>
  );
}

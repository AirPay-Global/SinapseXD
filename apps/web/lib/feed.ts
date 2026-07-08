import type { FeedStatus, PillarFeed } from "@sinapse/shared";

/**
 * Freshness helpers. While the demo pipeline stands in for live ingestion,
 * feeds report "live" with the fixed demo timestamp. Once Supabase queries
 * replace demo-data, derive status from the query: empty → "down", the query
 * promise's pending state → "loading", an age past the pillar's SLA → "stale".
 */

const DEMO_AS_OF = "2026-07-07T14:20:00Z";

export function liveFeed(asOf: string = DEMO_AS_OF): PillarFeed {
  return { status: "live", asOf };
}

export function downFeed(): PillarFeed {
  return { status: "down", asOf: null };
}

const STATUS_LABEL: Record<FeedStatus, string> = {
  live: "Live",
  loading: "Loading",
  stale: "Stale",
  down: "No feed",
};

export function feedLabel(feed: PillarFeed): string {
  if (feed.status === "down") return STATUS_LABEL.down;
  if (feed.status === "loading") return STATUS_LABEL.loading;
  const label = STATUS_LABEL[feed.status];
  return feed.asOf ? `${label} · as of ${formatAsOf(feed.asOf)}` : label;
}

export function formatAsOf(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${date}, ${time} UTC`;
}

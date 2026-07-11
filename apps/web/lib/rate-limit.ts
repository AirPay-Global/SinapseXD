import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Shared IP-based rate limiter for public-facing API routes (coding
 * convention, CLAUDE.md §11: "Rate limiting on all public-facing API
 * routes"). Backed by the same Upstash instance the pipeline uses for
 * BullMQ, via its REST API (works from a serverless/edge request handler,
 * unlike the TCP client the Python workers use).
 *
 * Degrades open, not closed: if Upstash env isn't configured, requests are
 * allowed through rather than the route 500ing — matches the rest of the
 * platform's "never throw, degrade honestly" pattern. This means rate
 * limiting is inactive in local dev without Upstash creds; it is active in
 * any deployed environment, where the env is always set.
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const limiters = new Map<string, Ratelimit>();

function limiterFor(name: string, limit: number, windowSeconds: number): Ratelimit | null {
  if (!url || !token) return null;
  const key = `${name}:${limit}:${windowSeconds}`;
  let rl = limiters.get(key);
  if (!rl) {
    rl = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `ratelimit:${name}`,
      analytics: false,
    });
    limiters.set(key, rl);
  }
  return rl;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/** Checks and consumes one request against `name`'s bucket for `identifier`
 * (typically the caller's IP). Always allows the request through when
 * Upstash isn't configured (see module doc) rather than blocking on a
 * missing dependency. */
export async function checkRateLimit(
  name: string,
  identifier: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const rl = limiterFor(name, limit, windowSeconds);
  if (!rl) return { success: true, limit, remaining: limit, reset: 0 };
  const { success, limit: lim, remaining, reset } = await rl.limit(identifier);
  return { success, limit: lim, remaining, reset };
}

/** Best-effort client identifier from standard proxy headers — Render sits
 * behind a proxy, so req.ip isn't populated; x-forwarded-for is. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

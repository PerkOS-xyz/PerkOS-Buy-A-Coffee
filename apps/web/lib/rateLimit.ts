/**
 * Fixed-window rate limiter, in memory, per serverless instance.
 *
 * First line of defense for the checkout: it caps how fast one IP or one
 * payer wallet can ask Stack to verify and settle, which is what costs gas.
 * Instances do not share state, so a determined attacker fanning out across
 * instances gets proportionally more, but a single script hammering one
 * region does not. Cheap, dependency-free, and enough until there is a
 * database-backed limiter to promote it to.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
let sweptAt = 0;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets, for Retry-After. */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): RateLimitResult {
  if (now - sweptAt > windowMs) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    sweptAt = now;
  }
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
  if (b.count >= limit) return { allowed: false, remaining: 0, retryAfter };
  b.count++;
  return { allowed: true, remaining: limit - b.count, retryAfter };
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** Test seam. */
export function resetRateLimits(): void {
  buckets.clear();
  sweptAt = 0;
}

/** Limits for the checkout, per minute. Prepare is cheap; settle spends sponsor gas. */
export const LIMITS = {
  prepareIp: { limit: 30, windowMs: 60_000 },
  prepareFrom: { limit: 10, windowMs: 60_000 },
  settleIp: { limit: 10, windowMs: 60_000 },
  settleFrom: { limit: 5, windowMs: 60_000 },
} as const;

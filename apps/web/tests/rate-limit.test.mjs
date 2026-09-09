import assert from "node:assert/strict";
import test from "node:test";

test("fixed window: allows up to the limit, then refuses until the window resets", async () => {
  const { rateLimit, resetRateLimits } = await import("../lib/rateLimit.ts");
  resetRateLimits();
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit("k", 3, 60_000, t0 + i).allowed, true);
  const refused = rateLimit("k", 3, 60_000, t0 + 10);
  assert.equal(refused.allowed, false);
  assert.equal(refused.remaining, 0);
  assert.ok(refused.retryAfter >= 59 && refused.retryAfter <= 60);
  // other keys are independent
  assert.equal(rateLimit("other", 3, 60_000, t0 + 10).allowed, true);
  // window reset
  assert.equal(rateLimit("k", 3, 60_000, t0 + 60_001).allowed, true);
});

test("client IP comes from x-forwarded-for first, then x-real-ip, else unknown", async () => {
  const { clientIp } = await import("../lib/rateLimit.ts");
  assert.equal(clientIp(new Request("https://x/", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } })), "1.2.3.4");
  assert.equal(clientIp(new Request("https://x/", { headers: { "x-real-ip": "5.6.7.8" } })), "5.6.7.8");
  assert.equal(clientIp(new Request("https://x/")), "unknown");
});

test("settle limits are tighter than prepare limits (settle spends sponsor gas)", async () => {
  const { LIMITS } = await import("../lib/rateLimit.ts");
  assert.ok(LIMITS.settleIp.limit < LIMITS.prepareIp.limit);
  assert.ok(LIMITS.settleFrom.limit < LIMITS.prepareFrom.limit);
  assert.ok(LIMITS.settleFrom.limit <= LIMITS.settleIp.limit);
});

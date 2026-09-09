import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isAddress, type Address, type Hex } from "viem";
import { z } from "zod";
import { getCreatorByHandle, insertCoffee } from "@/lib/db";
import { tryNetwork, MAX_USDC, MIN_USDC } from "@/lib/config";
import { buildTypedData, coffeeNonce, usdcUnits } from "@/lib/x402";
import { clientIp, LIMITS, rateLimit } from "@/lib/rateLimit";

const addr = z.string().refine((v) => isAddress(v, { strict: false }), "invalid address");

const Body = z
  .object({
    handle: z.string().min(1).max(40).optional(),
    payTo: addr.optional(),
    amount: z.number().min(MIN_USDC).max(MAX_USDC),
    memo: z.string().max(140).optional().nullable(),
    returnTo: z.string().url().optional().nullable(),
    from: addr,
    network: z.string().max(20).optional().nullable(),
  })
  .refine((b) => b.handle || b.payTo, "handle or payTo is required");

/**
 * Two modes:
 *  - handle: a registered creator (needs the database).
 *  - payTo: wallet mode, the widget passes the receiving wallet. No account,
 *    and the database is optional (the coffee row is best-effort).
 */
export async function POST(req: Request) {
  const ipLimit = rateLimit(`prepare:ip:${clientIp(req)}`, LIMITS.prepareIp.limit, LIMITS.prepareIp.windowMs);
  if (!ipLimit.allowed) return NextResponse.json({ ok: false, error: "Too many requests. Try again in a minute." }, { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  const { handle, amount, memo, returnTo, from } = parsed.data;
  const n = tryNetwork(parsed.data.network);
  if (!n) return NextResponse.json({ ok: false, error: "Network not enabled" }, { status: 400 });
  const fromLimit = rateLimit(`prepare:from:${from.toLowerCase()}`, LIMITS.prepareFrom.limit, LIMITS.prepareFrom.windowMs);
  if (!fromLimit.allowed) return NextResponse.json({ ok: false, error: "Too many coffees from this wallet. Try again in a minute." }, { status: 429, headers: { "Retry-After": String(fromLimit.retryAfter) } });

  let payTo: Address;
  let creatorId: string | null = null;
  let label: string;
  if (handle) {
    const creator = await getCreatorByHandle(handle).catch(() => null);
    if (!creator || !creator.active || !creator.pay_to) return NextResponse.json({ ok: false, error: "Creator not found" }, { status: 404 });
    payTo = creator.pay_to as Address;
    creatorId = creator.id;
    label = creator.handle || handle;
  } else {
    payTo = parsed.data.payTo!.toLowerCase() as Address;
    label = payTo;
  }
  if (payTo.toLowerCase() === from.toLowerCase()) return NextResponse.json({ ok: false, error: "You cannot buy yourself a coffee" }, { status: 400 });

  const coffeeId = `0x${randomBytes(32).toString("hex")}` as Hex;
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: from as Address,
    to: n.coffeeSplit,
    value: usdcUnits(amount),
    validAfter: "0",
    validBefore: String(now + 10 * 60),
    nonce: coffeeNonce(payTo, coffeeId),
  };

  try {
    await insertCoffee({
      coffee_id: coffeeId,
      creator_id: creatorId,
      pay_to: payTo,
      network: n.caip2,
      amount: amount.toFixed(6),
      memo: memo || null,
      return_to: returnTo || null,
      from_address: from.toLowerCase(),
    });
  } catch (e) {
    if (handle) return NextResponse.json({ ok: false, error: "Service unavailable" }, { status: 503 });
    console.warn("prepare: db unavailable, continuing in wallet mode", (e as Error).message);
  }

  const typedData = await buildTypedData(authorization, n);
  return NextResponse.json({ ok: true, coffeeId, payTo, label, network: n.key, symbol: n.symbol, authorization, typedData });
}

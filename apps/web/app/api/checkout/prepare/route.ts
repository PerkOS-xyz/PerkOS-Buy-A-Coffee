import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isAddress, type Address, type Hex } from "viem";
import { z } from "zod";
import { getCreatorByHandle, insertCoffee } from "@/lib/db";
import { getNetwork, MAX_USDC, MIN_USDC } from "@/lib/config";
import { buildTypedData, coffeeNonce, usdcUnits } from "@/lib/x402";

const Body = z.object({
  handle: z.string().min(1).max(40),
  amount: z.number().min(MIN_USDC).max(MAX_USDC),
  memo: z.string().max(140).optional().nullable(),
  returnTo: z.string().url().optional().nullable(),
  from: z.string().refine((v) => isAddress(v, { strict: false }), "invalid address"),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  const { handle, amount, memo, returnTo, from } = parsed.data;

  const creator = await getCreatorByHandle(handle);
  if (!creator || !creator.active || !creator.pay_to) return NextResponse.json({ ok: false, error: "Creator not found" }, { status: 404 });

  const n = getNetwork();
  const coffeeId = `0x${randomBytes(32).toString("hex")}` as Hex;
  const value = usdcUnits(amount);
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: from as Address,
    to: n.coffeeSplit,
    value,
    validAfter: "0",
    validBefore: String(now + 10 * 60),
    nonce: coffeeNonce(creator.pay_to as Address, coffeeId),
  };

  await insertCoffee({
    coffee_id: coffeeId,
    creator_id: creator.id,
    network: n.caip2,
    amount: amount.toFixed(6),
    memo: memo || null,
    return_to: returnTo || null,
    from_address: from.toLowerCase(),
  });

  const typedData = await buildTypedData(authorization);
  return NextResponse.json({ ok: true, coffeeId, authorization, typedData });
}

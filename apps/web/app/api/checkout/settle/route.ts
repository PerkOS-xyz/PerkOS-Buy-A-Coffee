import { NextResponse } from "next/server";
import { isHex, type Address, type Hex } from "viem";
import { z } from "zod";
import { getCoffee, getCreatorById, markCoffee } from "@/lib/db";
import { APP_URL, getNetwork, FEE_BPS } from "@/lib/config";
import { coffeeNonce, settleCoffee, usdcUnits } from "@/lib/x402";
import { isAllowedReturnTo, withResult } from "@/lib/returnTo";

export const maxDuration = 120;

const Body = z.object({
  coffeeId: z.string().refine((v) => isHex(v) && v.length === 66, "invalid coffee id"),
  signature: z.string().refine((v) => isHex(v) && (v.length === 132 || v.length === 130), "invalid signature"),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  const { coffeeId, signature } = parsed.data;

  const coffee = await getCoffee(coffeeId);
  if (!coffee) return NextResponse.json({ ok: false, error: "Unknown coffee" }, { status: 404 });
  if (coffee.status === "settled") {
    return NextResponse.json({ ok: true, transaction: coffee.tx_hash, alreadySettled: true });
  }
  const creator = await getCreatorById(coffee.creator_id);
  if (!creator || !creator.pay_to || !creator.handle) return NextResponse.json({ ok: false, error: "Creator not found" }, { status: 404 });
  if (!coffee.from_address) return NextResponse.json({ ok: false, error: "Coffee has no payer" }, { status: 400 });

  const n = getNetwork();
  const amount = Number(coffee.amount);
  const created = Math.floor(new Date(coffee.created_at).getTime() / 1000);
  // Same window prepare() used: validBefore = created + 10 min. Recomputed, never trusted from the client.
  const authorization = {
    from: coffee.from_address as Address,
    to: n.coffeeSplit,
    value: usdcUnits(amount),
    validAfter: "0",
    validBefore: String(created + 10 * 60),
    nonce: coffeeNonce(creator.pay_to as Address, coffeeId as Hex),
  };
  if (Math.floor(Date.now() / 1000) > created + 10 * 60) {
    await markCoffee(coffeeId, { status: "failed", error: "expired" });
    return NextResponse.json({ ok: false, error: "This payment window expired. Please start again." }, { status: 410 });
  }

  const result = await settleCoffee({
    handle: creator.handle,
    amountUnits: authorization.value,
    creator: creator.pay_to as Address,
    coffeeId: coffeeId as Hex,
    memo: coffee.memo,
    authorization,
    signature: signature as Hex,
  });

  if (!result.ok) {
    await markCoffee(coffeeId, { status: "failed", error: result.reason || "failed" });
    return NextResponse.json({ ok: false, error: result.reason || "Settlement failed" }, { status: 402 });
  }

  const fee = ((amount * FEE_BPS) / 10000).toFixed(6);
  await markCoffee(coffeeId, { status: "settled", tx_hash: result.transaction ?? null, fee, error: null });

  let redirect: string | null = null;
  if (coffee.return_to && isAllowedReturnTo(coffee.return_to, creator.allowed_origins, APP_URL)) {
    redirect = withResult(coffee.return_to, { status: "paid", tx: result.transaction, amount: String(amount) });
  }
  return NextResponse.json({ ok: true, transaction: result.transaction ?? null, redirect });
}

import { NextResponse } from "next/server";
import { isAddress, isHex, type Address, type Hex } from "viem";
import { z } from "zod";
import { getCoffee, getCreatorById, insertCoffee, markCoffee } from "@/lib/db";
import { APP_URL, getNetwork, FEE_BPS, MAX_USDC, MIN_USDC } from "@/lib/config";
import { coffeeNonce, settleCoffee, usdcUnits } from "@/lib/x402";
import { isAllowedReturnTo, withResult } from "@/lib/returnTo";

export const maxDuration = 120;

const addr = z.string().refine((v) => isAddress(v, { strict: false }), "invalid address");
const b32 = z.string().refine((v) => isHex(v) && v.length === 66, "invalid bytes32");

const Body = z.object({
  coffeeId: b32,
  signature: z.string().refine((v) => isHex(v) && (v.length === 132 || v.length === 130), "invalid signature"),
  // Wallet mode: the client sends back what prepare() returned; everything is re-derived and checked here.
  wallet: z
    .object({
      payTo: addr,
      from: addr,
      amount: z.number().min(MIN_USDC).max(MAX_USDC),
      validBefore: z.string().regex(/^\d+$/),
      memo: z.string().max(140).optional().nullable(),
      returnTo: z.string().url().optional().nullable(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  const { coffeeId, signature, wallet } = parsed.data;
  const n = getNetwork();
  const nowSec = Math.floor(Date.now() / 1000);

  // Resolve the coffee: from the database (handle mode) or from the wallet-mode payload.
  let payTo: Address;
  let from: Address;
  let amount: number;
  let validBefore: number;
  let memo: string | null;
  let returnTo: string | null;
  let label: string;
  let allowedOrigins: string[] = [];
  let hasRow = false;

  const row = await getCoffee(coffeeId).catch(() => null);
  if (row) {
    hasRow = true;
    if (row.status === "settled") return NextResponse.json({ ok: true, transaction: row.tx_hash, alreadySettled: true });
    if (!row.from_address) return NextResponse.json({ ok: false, error: "Coffee has no payer" }, { status: 400 });
    const creator = row.creator_id ? await getCreatorById(row.creator_id).catch(() => null) : null;
    payTo = ((creator?.pay_to || row.pay_to) as Address | null) ?? ("" as Address);
    if (!payTo) return NextResponse.json({ ok: false, error: "Coffee has no recipient" }, { status: 400 });
    from = row.from_address as Address;
    amount = Number(row.amount);
    validBefore = Math.floor(new Date(row.created_at).getTime() / 1000) + 10 * 60;
    memo = row.memo;
    returnTo = row.return_to;
    label = creator?.handle || payTo;
    allowedOrigins = creator?.allowed_origins ?? [];
  } else if (wallet) {
    payTo = wallet.payTo.toLowerCase() as Address;
    from = wallet.from.toLowerCase() as Address;
    amount = wallet.amount;
    validBefore = Number(wallet.validBefore);
    memo = wallet.memo || null;
    returnTo = wallet.returnTo || null;
    label = payTo;
    if (validBefore > nowSec + 10 * 60 + 60) return NextResponse.json({ ok: false, error: "Invalid window" }, { status: 400 });
  } else {
    return NextResponse.json({ ok: false, error: "Unknown coffee" }, { status: 404 });
  }

  if (nowSec > validBefore) {
    if (hasRow) await markCoffee(coffeeId, { status: "failed", error: "expired" }).catch(() => {});
    return NextResponse.json({ ok: false, error: "This payment window expired. Please start again." }, { status: 410 });
  }

  const authorization = {
    from,
    to: n.coffeeSplit,
    value: usdcUnits(amount),
    validAfter: "0",
    validBefore: String(validBefore),
    nonce: coffeeNonce(payTo, coffeeId as Hex),
  };

  const result = await settleCoffee({
    handle: label,
    amountUnits: authorization.value,
    creator: payTo,
    coffeeId: coffeeId as Hex,
    memo,
    authorization,
    signature: signature as Hex,
  });

  const fee = ((amount * FEE_BPS) / 10000).toFixed(6);
  // Best-effort persistence in wallet mode; required rows already exist in handle mode.
  try {
    if (!hasRow) {
      await insertCoffee({ coffee_id: coffeeId, creator_id: null, pay_to: payTo, network: n.caip2, amount: amount.toFixed(6), memo, return_to: returnTo, from_address: from });
    }
    await markCoffee(coffeeId, result.ok ? { status: "settled", tx_hash: result.transaction ?? null, fee, error: null } : { status: "failed", error: result.reason || "failed" });
  } catch (e) {
    console.warn("settle: db unavailable", (e as Error).message);
  }

  if (!result.ok) return NextResponse.json({ ok: false, error: result.reason || "Settlement failed" }, { status: 402 });

  // Auto-redirect only for registered creators with allowed origins; wallet mode gets a manual "back" link.
  let redirect: string | null = null;
  if (returnTo && allowedOrigins.length && isAllowedReturnTo(returnTo, allowedOrigins, APP_URL)) {
    redirect = withResult(returnTo, { status: "paid", tx: result.transaction, amount: String(amount) });
  }
  const backTo = returnTo && !redirect ? safeBack(returnTo, result.transaction, amount) : null;
  return NextResponse.json({ ok: true, transaction: result.transaction ?? null, redirect, backTo });
}

function safeBack(returnTo: string, tx: string | null | undefined, amount: number): string | null {
  try {
    const u = new URL(returnTo);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return withResult(u.toString(), { status: "paid", tx, amount: String(amount) });
  } catch {
    return null;
  }
}

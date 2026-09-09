import { NextResponse } from "next/server";
import { isAddress, isHex, type Address, type Hex } from "viem";
import { setSession, verifyChallenge } from "@/lib/auth";
import { upsertCreatorByWallet } from "@/lib/db";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { address?: string; token?: string; signature?: string };
  if (!body.address || !isAddress(body.address, { strict: false }) || !body.token || !body.signature || !isHex(body.signature)) {
    return NextResponse.json({ ok: false, error: "invalid input" }, { status: 400 });
  }
  const wallet = await verifyChallenge(body.token, body.signature as Hex, body.address as Address);
  if (!wallet) return NextResponse.json({ ok: false, error: "signature rejected" }, { status: 401 });
  await setSession(wallet);
  // Profile row is optional (no database → chain-only dashboard).
  await upsertCreatorByWallet(wallet).catch(() => null);
  return NextResponse.json({ ok: true, wallet });
}

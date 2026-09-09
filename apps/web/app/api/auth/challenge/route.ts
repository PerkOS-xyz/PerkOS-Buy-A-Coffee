import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { issueChallenge } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { address?: string };
  if (!body.address || !isAddress(body.address, { strict: false })) return NextResponse.json({ ok: false, error: "invalid address" }, { status: 400 });
  const { message, token } = issueChallenge(body.address);
  return NextResponse.json({ ok: true, message, token });
}

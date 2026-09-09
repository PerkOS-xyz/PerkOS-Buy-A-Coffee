import { NextResponse } from "next/server";
import { z } from "zod";
import { issueMagicToken } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";

const Body = z.object({ email: z.string().email().max(200) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter a valid email" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const token = await issueMagicToken(email);
  await sendMagicLink(email, token);
  return NextResponse.json({ ok: true });
}

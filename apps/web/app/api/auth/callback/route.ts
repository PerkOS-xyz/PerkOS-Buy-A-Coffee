import { NextResponse } from "next/server";
import { redeemMagicToken, setSession } from "@/lib/auth";
import { APP_URL } from "@/lib/config";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const creator = token ? await redeemMagicToken(token) : null;
  if (!creator) return NextResponse.redirect(`${APP_URL}/login?error=expired`);
  await setSession(creator.id);
  return NextResponse.redirect(`${APP_URL}/dashboard`);
}

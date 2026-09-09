import { NextResponse } from "next/server";
import { countSettled, getCreatorByHandle } from "@/lib/db";
import { publicConfig } from "@/lib/config";

/** Public creator profile, read by the widget and by agents. */
export async function GET(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  let c;
  try {
    c = await getCreatorByHandle(handle);
  } catch (e) {
    console.error("creators: db unavailable", (e as Error).message);
    return NextResponse.json({ error: "service not configured" }, { status: 503 });
  }
  if (!c || !c.active || !c.handle || !c.pay_to) return NextResponse.json({ error: "not found" }, { status: 404 });
  const stats = await countSettled(c.id);
  const cfg = publicConfig();
  return NextResponse.json({
    handle: c.handle,
    displayName: c.display_name || c.handle,
    avatarUrl: c.avatar_url,
    message: c.message,
    amounts: c.default_amounts,
    network: cfg.caip2,
    token: "USDC",
    checkoutUrl: `${cfg.appUrl}/${c.handle}`,
    badgeUrl: `${cfg.appUrl}/badge/${c.handle}.svg`,
    coffees: stats.count,
  });
}

/**
 * GET /api/health — liveness plus the one number that decides whether coffees
 * settle: the sponsor wallet's gas balance on the configured network.
 *
 * Stack pays gas for every settlement from the PerkOS sponsor wallet. When it
 * runs dry, settle fails and the donor loses nothing, but nothing is sold.
 * This endpoint reports the balance against SPONSOR_LOW_ETH and, when called
 * with ?alert=1 (the Vercel cron does, daily), posts to ALERT_WEBHOOK_URL if
 * the balance is low. Without a webhook the flag still shows here and in logs.
 */
import { NextResponse } from "next/server";
import { createPublicClient, formatEther, http, isAddress, type Address } from "viem";
import { getNetwork } from "@/lib/config";

export const dynamic = "force-dynamic";

const SPONSOR_WALLET = (process.env.SPONSOR_WALLET_ADDRESS || "0xdeB7B3F9D1698589E7024abF301B23Fa18533d12") as Address;
const LOW_ETH = Number(process.env.SPONSOR_LOW_ETH || "0.005");

export async function GET(req: Request) {
  const n = getNetwork();
  const url = new URL(req.url);
  const out: Record<string, unknown> = { ok: true, network: n.key, coffeeSplit: n.coffeeSplit, sponsorWallet: SPONSOR_WALLET, lowThresholdEth: LOW_ETH };

  if (!isAddress(SPONSOR_WALLET, { strict: false })) {
    return NextResponse.json({ ...out, ok: false, error: "SPONSOR_WALLET_ADDRESS is not an address" }, { status: 500 });
  }
  try {
    const client = createPublicClient({ transport: http(n.rpcUrl) });
    const wei = await client.getBalance({ address: SPONSOR_WALLET });
    const eth = Number(formatEther(wei));
    const low = eth < LOW_ETH;
    Object.assign(out, { sponsorBalanceEth: eth, sponsorLow: low });
    if (low) console.warn(`[health] sponsor wallet ${SPONSOR_WALLET} low on ${n.key}: ${eth} ETH < ${LOW_ETH}`);
    if (low && url.searchParams.get("alert") === "1" && process.env.ALERT_WEBHOOK_URL) {
      const text = `Buy A Coffee: sponsor wallet ${SPONSOR_WALLET} has ${eth.toFixed(5)} ETH on ${n.key} (threshold ${LOW_ETH}). Settlements will fail when it hits zero.`;
      const r = await fetch(process.env.ALERT_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }) }).catch((e: Error) => ({ ok: false, status: 0, statusText: e.message }));
      out.alertSent = r.ok;
      if (!r.ok) out.alertError = `${r.status} ${r.statusText}`;
    }
  } catch (e) {
    Object.assign(out, { ok: false, error: `balance lookup failed: ${(e as Error).message}` });
  }
  return NextResponse.json(out, { status: out.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

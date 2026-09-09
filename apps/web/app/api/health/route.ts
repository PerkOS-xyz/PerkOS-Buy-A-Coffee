/**
 * GET /api/health — liveness plus the one number per network that decides
 * whether coffees settle there: the sponsor wallet's gas balance.
 *
 * Stack pays gas for every settlement from the PerkOS sponsor wallet. When it
 * runs dry on a network, settle fails there and the donor loses nothing, but
 * nothing is sold. This endpoint reports each enabled network's balance
 * against SPONSOR_LOW_<KEY> (or SPONSOR_LOW_ETH) and, when called with
 * ?alert=1 (the Vercel cron does, daily), posts to ALERT_WEBHOOK_URL if any is
 * low. Without a webhook the flags still show here and in logs.
 */
import { NextResponse } from "next/server";
import { createPublicClient, formatEther, http, isAddress, type Address } from "viem";
import { enabledNetworks } from "@/lib/config";

export const dynamic = "force-dynamic";

const SPONSOR_WALLET = (process.env.SPONSOR_WALLET_ADDRESS || "0xdeB7B3F9D1698589E7024abF301B23Fa18533d12") as Address;
const LOW_DEFAULT = Number(process.env.SPONSOR_LOW_ETH || "0.005");

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAddress(SPONSOR_WALLET, { strict: false })) {
    return NextResponse.json({ ok: false, error: "SPONSOR_WALLET_ADDRESS is not an address" }, { status: 500 });
  }
  const networks = await Promise.all(
    enabledNetworks().map(async (n) => {
      const low = Number(process.env[`SPONSOR_LOW_${n.key.toUpperCase().replace(/-/g, "_")}`] || LOW_DEFAULT);
      try {
        const wei = await createPublicClient({ transport: http(n.rpcUrl) }).getBalance({ address: SPONSOR_WALLET });
        const balance = Number(formatEther(wei));
        if (balance < low) console.warn(`[health] sponsor wallet ${SPONSOR_WALLET} low on ${n.key}: ${balance} ${n.native.symbol} < ${low}`);
        return { network: n.key, coffeeSplit: n.coffeeSplit, symbol: n.symbol, gas: n.native.symbol, sponsorBalance: balance, lowThreshold: low, sponsorLow: balance < low, ok: true };
      } catch (e) {
        return { network: n.key, coffeeSplit: n.coffeeSplit, symbol: n.symbol, gas: n.native.symbol, ok: false, error: (e as Error).message };
      }
    }),
  );
  const ok = networks.every((n) => n.ok);
  const lowOnes = networks.filter((n) => n.sponsorLow);
  const out: Record<string, unknown> = { ok, sponsorWallet: SPONSOR_WALLET, networks, sponsorLow: lowOnes.length > 0 };
  // Backward-compatible top-level fields for the default network.
  const first = networks[0];
  if (first) Object.assign(out, { network: first.network, coffeeSplit: first.coffeeSplit, sponsorBalanceEth: first.sponsorBalance, lowThresholdEth: first.lowThreshold });

  if (lowOnes.length && url.searchParams.get("alert") === "1" && process.env.ALERT_WEBHOOK_URL) {
    const text = `Buy A Coffee: sponsor wallet ${SPONSOR_WALLET} is low on ${lowOnes.map((n) => `${n.network} (${Number(n.sponsorBalance).toFixed(5)} ${n.gas} < ${n.lowThreshold})`).join(", ")}. Settlements fail there when it hits zero.`;
    const r = await fetch(process.env.ALERT_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }) }).catch((e: Error) => ({ ok: false, status: 0, statusText: e.message }));
    out.alertSent = r.ok;
    if (!r.ok) out.alertError = `${r.status} ${r.statusText}`;
  }
  return NextResponse.json(out, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

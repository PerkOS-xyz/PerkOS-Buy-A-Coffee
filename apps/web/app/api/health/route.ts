/**
 * GET /api/health — liveness plus, per network, the two things that decide
 * whether Buy A Coffee works there: the sponsor wallet's gas balance (settle)
 * and the event index (dashboards, badges, /api/me/coffees).
 *
 * Stack pays gas for every settlement from the PerkOS sponsor wallet. When it
 * runs dry on a network, settle fails there and the donor loses nothing, but
 * nothing is sold. This endpoint reports each enabled network's balance
 * against SPONSOR_LOW_<KEY> (or SPONSOR_LOW_ETH) and, when called with
 * ?alert=1 (the Vercel cron does, daily), posts to ALERT_WEBHOOK_URL if any is
 * low or any network's scan fails. Without a webhook the flags still show here
 * and in logs.
 */
import { NextResponse } from "next/server";
import { createPublicClient, formatEther, http, isAddress, type Address } from "viem";
import { enabledNetworks } from "@/lib/config";
import { scanHealth } from "@/lib/chain";

export const dynamic = "force-dynamic";

interface NetworkHealth {
  network: string;
  coffeeSplit: string;
  symbol: string;
  gas: string;
  scan: { ok: boolean; coffees: number; scannedTo: number | null; chunk: number; calls: number; ms: number; error?: string; stale?: boolean };
  ok: boolean;
  error?: string;
  sponsorBalance?: number;
  lowThreshold?: number;
  sponsorLow?: boolean;
}

const SPONSOR_WALLET = (process.env.SPONSOR_WALLET_ADDRESS || "0xdeB7B3F9D1698589E7024abF301B23Fa18533d12") as Address;
const LOW_DEFAULT = Number(process.env.SPONSOR_LOW_ETH || "0.005");

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAddress(SPONSOR_WALLET, { strict: false })) {
    return NextResponse.json({ ok: false, error: "SPONSOR_WALLET_ADDRESS is not an address" }, { status: 500 });
  }
  const networks: NetworkHealth[] = await Promise.all(
    enabledNetworks().map(async (n): Promise<NetworkHealth> => {
      const low = Number(process.env[`SPONSOR_LOW_${n.key.toUpperCase().replace(/-/g, "_")}`] || LOW_DEFAULT);
      const [balanceResult, s] = await Promise.all([
        createPublicClient({ transport: http(n.rpcUrl) }).getBalance({ address: SPONSOR_WALLET }).then(
          (wei) => ({ balance: Number(formatEther(wei)) }),
          (e: Error) => ({ error: e.message }),
        ),
        scanHealth(n),
      ]);
      const scan = { ok: s.ok, coffees: s.coffees, scannedTo: s.scannedTo === null ? null : Number(s.scannedTo), chunk: Number(s.chunk), calls: s.calls, ms: s.ms, ...(s.error ? { error: s.error } : {}), ...(s.stale ? { stale: true } : {}) };
      if (!s.ok) console.warn(`[health] coffee index failed on ${n.key}: ${s.error}`);
      const base = { network: n.key, coffeeSplit: n.coffeeSplit, symbol: n.symbol, gas: n.native.symbol, scan };
      if ("error" in balanceResult) return { ...base, ok: false, error: balanceResult.error };
      const balance = balanceResult.balance;
      if (balance < low) console.warn(`[health] sponsor wallet ${SPONSOR_WALLET} low on ${n.key}: ${balance} ${n.native.symbol} < ${low}`);
      return { ...base, sponsorBalance: balance, lowThreshold: low, sponsorLow: balance < low, ok: s.ok };
    }),
  );
  const ok = networks.every((n) => n.ok);
  const lowOnes = networks.filter((n) => n.sponsorLow);
  const brokenIndex = networks.filter((n) => !n.scan.ok);
  const out: Record<string, unknown> = { ok, sponsorWallet: SPONSOR_WALLET, networks, sponsorLow: lowOnes.length > 0, indexOk: brokenIndex.length === 0 };
  // Backward-compatible top-level fields for the default network.
  const first = networks[0];
  if (first) Object.assign(out, { network: first.network, coffeeSplit: first.coffeeSplit, sponsorBalanceEth: first.sponsorBalance, lowThresholdEth: first.lowThreshold });

  if ((lowOnes.length || brokenIndex.length) && url.searchParams.get("alert") === "1" && process.env.ALERT_WEBHOOK_URL) {
    const parts: string[] = [];
    if (lowOnes.length) parts.push(`sponsor wallet ${SPONSOR_WALLET} is low on ${lowOnes.map((n) => `${n.network} (${Number(n.sponsorBalance).toFixed(5)} ${n.gas} < ${n.lowThreshold})`).join(", ")}. Settlements fail there when it hits zero.`);
    if (brokenIndex.length) parts.push(`coffee index failed on ${brokenIndex.map((n) => `${n.network} (${n.scan.error})`).join(", ")}. Dashboards and badges miss those coffees.`);
    const text = `Buy A Coffee: ${parts.join(" ")}`;
    const r = await fetch(process.env.ALERT_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }) }).catch((e: Error) => ({ ok: false, status: 0, statusText: e.message }));
    out.alertSent = r.ok;
    if (!r.ok) out.alertError = `${r.status} ${r.statusText}`;
  }
  return NextResponse.json(out, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import { currentWallet } from "@/lib/auth";
import { coffeesReceived, coffeesSent } from "@/lib/chain";
import { enabledNetworkKeys, explorerTx } from "@/lib/config";

/** Received and sent coffees for the signed-in wallet, read from the CoffeeSplit events on every enabled network. */
export async function GET() {
  const wallet = await currentWallet();
  if (!wallet) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [received, sent] = await Promise.all([coffeesReceived(wallet), coffeesSent(wallet)]);
  const map = (list: Awaited<ReturnType<typeof coffeesReceived>>) =>
    list.map((c) => ({
      network: c.network,
      symbol: c.symbol,
      txHash: c.txHash,
      explorer: explorerTx(c.network, c.txHash),
      creator: c.creator,
      from: c.from,
      amount: formatUnits(c.value, 6),
      fee: formatUnits(c.fee, 6),
      timestamp: c.timestamp,
    }));
  return NextResponse.json({ wallet, networks: enabledNetworkKeys(), received: map(received), sent: map(sent) });
}

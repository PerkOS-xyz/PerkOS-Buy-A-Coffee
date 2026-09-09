import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import { currentWallet } from "@/lib/auth";
import { coffeesReceived, coffeesSent } from "@/lib/chain";
import { getNetwork } from "@/lib/config";

/** Received and sent coffees for the signed-in wallet, read from the CoffeeSplit events. */
export async function GET() {
  const wallet = await currentWallet();
  if (!wallet) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const n = getNetwork();
  const [received, sent] = await Promise.all([coffeesReceived(wallet), coffeesSent(wallet)]);
  const map = (list: Awaited<ReturnType<typeof coffeesReceived>>) =>
    list.map((c) => ({
      txHash: c.txHash,
      explorer: n.explorerTx(c.txHash),
      creator: c.creator,
      from: c.from,
      amount: formatUnits(c.value, 6),
      fee: formatUnits(c.fee, 6),
      timestamp: c.timestamp,
    }));
  return NextResponse.json({ wallet, network: n.caip2, received: map(received), sent: map(sent) });
}

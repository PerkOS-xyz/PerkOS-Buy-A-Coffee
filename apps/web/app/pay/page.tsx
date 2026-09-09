import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { publicConfig, tryNetwork } from "@/lib/config";
import Checkout from "../[handle]/Checkout";

export const dynamic = "force-dynamic";

type Search = { to?: string; name?: string; amount?: string; memo?: string; return_to?: string; network?: string };

/** Wallet mode: /pay?to=0x…&name=…  No account, no database needed. */
export default async function PayPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const to = typeof q.to === "string" ? q.to : "";
  if (!isAddress(to, { strict: false })) notFound();
  const name = typeof q.name === "string" ? q.name.slice(0, 80) : "";
  const preset = q.amount ? Number(q.amount) : null;
  const returnTo = typeof q.return_to === "string" ? q.return_to : null;
  let host: string | null = null;
  try {
    host = returnTo ? new URL(returnTo).host : null;
  } catch {
    host = null;
  }
  const short = `${to.slice(0, 6)}…${to.slice(-4)}`;
  const network = tryNetwork(typeof q.network === "string" ? q.network : null);
  const config = publicConfig(network?.key);

  return (
    <main className="wrap">
      <div className="lbl">Buy a coffee for</div>
      <h1>{name || short}</h1>
      <p className="dim">
        {config.symbol} on {config.networkName} goes straight to <code>{short}</code>{host ? <> · from <strong>{host}</strong></> : null}.
      </p>
      <Checkout
        handle={null}
        payTo={to.toLowerCase()}
        displayName={name || short}
        amounts={[5, 10, 50]}
        presetAmount={preset && Number.isFinite(preset) ? preset : null}
        presetMemo={typeof q.memo === "string" ? q.memo.slice(0, 140) : ""}
        returnTo={returnTo}
        returnAllowed={false}
        config={config}
      />
    </main>
  );
}

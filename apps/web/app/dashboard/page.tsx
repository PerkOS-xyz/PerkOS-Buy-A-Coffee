import { redirect } from "next/navigation";
import { formatUnits } from "viem";
import { currentWallet } from "@/lib/auth";
import { coffeesReceived, coffeesSent } from "@/lib/chain";
import { getCreatorByWallet } from "@/lib/db";
import { publicConfig } from "@/lib/config";
import DashboardForm from "./DashboardForm";
import WidgetBuilder from "./WidgetBuilder";

export const dynamic = "force-dynamic";

function when(ts: number | null) {
  return ts ? new Date(ts * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
}
function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default async function Dashboard() {
  const wallet = await currentWallet();
  if (!wallet) redirect("/login");
  const cfg = publicConfig();
  const [received, sent] = await Promise.all([coffeesReceived(wallet).catch(() => []), coffeesSent(wallet).catch(() => [])]);
  let profile = null;
  let dbAvailable = true;
  try {
    profile = await getCreatorByWallet(wallet);
  } catch {
    dbAvailable = false;
  }
  const totalReceived = received.reduce((s, c) => s + c.value - c.fee, 0n);
  const totalSent = sent.reduce((s, c) => s + c.value, 0n);

  return (
    <main className="wrap wide">
      <div className="lbl">Dashboard</div>
      <h1>{profile?.display_name || profile?.handle || short(wallet)}</h1>
      <p className="note">Wallet {wallet} · {cfg.networkName} · history read from the CoffeeSplit contract.</p>

      <div style={{ margin: "1rem 0 1.5rem" }}>
        <span className="stat"><b>{received.length}</b><span>coffees received</span></span>
        <span className="stat"><b>{formatUnits(totalReceived, 6)}</b><span>USDC received (after fee)</span></span>
        <span className="stat"><b>{sent.length}</b><span>coffees sent</span></span>
        <span className="stat"><b>{formatUnits(totalSent, 6)}</b><span>USDC sent</span></span>
      </div>

      <h2>Your button</h2>
      <p className="note">Wallet mode needs no setup: coffees go straight to {short(wallet)}. Tune the button, watch the preview, copy the snippet.</p>
      <p className="note">You never pay gas and you need no other account. The 2% fee covers the facilitator's gas, so every coffee arrives in your wallet as USDC, already settled.</p>
      <WidgetBuilder wallet={wallet} appUrl={cfg.appUrl} initialName={profile?.display_name || ""} />

      <h2>Coffees received</h2>
      {received.length === 0 ? <p className="note">None yet.</p> : (
        <table className="tbl">
          <thead><tr><th>When</th><th>From</th><th>Amount</th><th>You got</th><th>Tx</th></tr></thead>
          <tbody>
            {received.slice(0, 50).map((c) => (
              <tr key={c.txHash + c.nonce}>
                <td>{when(c.timestamp)}</td>
                <td className="note">{short(c.from)}</td>
                <td>{formatUnits(c.value, 6)} USDC</td>
                <td>{formatUnits(c.value - c.fee, 6)} USDC</td>
                <td><a href={cfg.network === "base" ? `https://basescan.org/tx/${c.txHash}` : `https://sepolia.basescan.org/tx/${c.txHash}`} target="_blank" rel="noreferrer">view</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Coffees sent</h2>
      {sent.length === 0 ? <p className="note">None yet.</p> : (
        <table className="tbl">
          <thead><tr><th>When</th><th>To</th><th>Amount</th><th>Tx</th></tr></thead>
          <tbody>
            {sent.slice(0, 50).map((c) => (
              <tr key={c.txHash + c.nonce}>
                <td>{when(c.timestamp)}</td>
                <td className="note">{short(c.creator)}</td>
                <td>{formatUnits(c.value, 6)} USDC</td>
                <td><a href={cfg.network === "base" ? `https://basescan.org/tx/${c.txHash}` : `https://sepolia.basescan.org/tx/${c.txHash}`} target="_blank" rel="noreferrer">view</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Profile page (optional)</h2>
      {dbAvailable ? (
        <DashboardForm
          initial={{
            handle: profile?.handle || "",
            payTo: profile?.pay_to || wallet,
            displayName: profile?.display_name || "",
            avatarUrl: profile?.avatar_url || "",
            message: profile?.message || "",
            amounts: (profile?.default_amounts || [5, 10, 50]).join(", "),
            allowedOrigins: (profile?.allowed_origins || []).join("\n"),
          }}
          appUrl={cfg.appUrl}
        />
      ) : (
        <p className="note">A handle, profile page and automatic returns need the database, which is not configured on this deployment yet. Your wallet button above works regardless.</p>
      )}
    </main>
  );
}

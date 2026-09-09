import { redirect } from "next/navigation";
import { currentCreator } from "@/lib/auth";
import { countSettled, listCoffees } from "@/lib/db";
import { publicConfig } from "@/lib/config";
import DashboardForm from "./DashboardForm";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const me = await currentCreator();
  if (!me) redirect("/login");
  const [coffees, stats] = await Promise.all([listCoffees(me.id, 50), countSettled(me.id)]);
  const cfg = publicConfig();
  const ready = !!(me.handle && me.pay_to);

  return (
    <main className="wrap wide">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="lbl">Dashboard</div>
          <h1>{me.display_name || me.handle || me.email}</h1>
        </div>
        <form action="/api/auth/logout" method="post"><button className="btn ghost" type="submit">Sign out</button></form>
      </div>

      <div style={{ margin: "1rem 0 1.5rem" }}>
        <span className="stat"><b>{stats.count}</b><span>coffees</span></span>
        <span className="stat"><b>{Number(stats.total).toFixed(2)}</b><span>USDC received (before fee)</span></span>
        <span className="stat"><b>{cfg.networkName}</b><span>network</span></span>
      </div>

      <DashboardForm
        initial={{
          handle: me.handle || "",
          payTo: me.pay_to || "",
          displayName: me.display_name || "",
          avatarUrl: me.avatar_url || "",
          message: me.message || "",
          amounts: me.default_amounts.join(", "),
          allowedOrigins: me.allowed_origins.join("\n"),
        }}
        appUrl={cfg.appUrl}
      />

      {ready ? (
        <>
          <h2>Your snippets</h2>
          <p className="note">Your page: <a href={`${cfg.appUrl}/${me.handle}`}>{cfg.appUrl}/{me.handle}</a></p>
          <div className="lbl" style={{ marginTop: "1rem" }}>Script tag (any site)</div>
          <pre className="snip">{`<script src="${cfg.appUrl}/widget.js" data-handle="${me.handle}" data-amount="5"></script>`}</pre>
          <div className="lbl">GitHub README badge</div>
          <pre className="snip">{`[![Buy me an x402 coffee](${cfg.appUrl}/badge/${me.handle}.svg)](${cfg.appUrl}/${me.handle})`}</pre>
          <div className="lbl">React</div>
          <pre className="snip">{`import { BuyACoffee } from "@perkos/buy-a-coffee/react";\n<BuyACoffee handle="${me.handle}" amount={5} />`}</pre>
          <p className="note">Add the origins of the sites where you embed the button to "Allowed origins" above; the checkout only redirects donors back to those.</p>
        </>
      ) : (
        <p className="msg err" style={{ marginTop: "1.5rem" }}>Set a handle and a receiving wallet to activate your page.</p>
      )}

      <h2>Recent coffees</h2>
      {coffees.length === 0 ? (
        <p className="note">No coffees yet.</p>
      ) : (
        <table className="tbl">
          <thead><tr><th>When</th><th>Amount</th><th>Status</th><th>From</th><th>Memo</th><th>Tx</th></tr></thead>
          <tbody>
            {coffees.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td>{Number(c.amount).toFixed(2)} USDC</td>
                <td>{c.status}{c.error ? <span className="note"> · {c.error}</span> : null}</td>
                <td className="note">{c.from_address ? `${c.from_address.slice(0, 6)}…${c.from_address.slice(-4)}` : ""}</td>
                <td className="note">{c.memo || ""}</td>
                <td>{c.tx_hash ? <a href={cfg.network === "base" ? `https://basescan.org/tx/${c.tx_hash}` : `https://sepolia.basescan.org/tx/${c.tx_hash}`} target="_blank" rel="noreferrer">view</a> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

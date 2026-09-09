import { publicConfig } from "@/lib/config";

export default function Landing() {
  const cfg = publicConfig();
  return (
    <main className="wrap">
      <div className="lbl">PerkOS · x402</div>
      <h1>Buy A Coffee, paid in USDC, one signature.</h1>
      <p className="dim">
        A donation button for any site and any GitHub README. Donors pay from their own wallet, no account, no gas.
        The PerkOS facilitator settles on {cfg.networkName}; the creator receives 98% instantly and 2% covers the gas.
      </p>
      <div className="row" style={{ marginTop: "1.5rem" }}>
        <a className="btn" href="/dashboard">Create your page</a>
        <a className="btn ghost" href="https://github.com/PerkOS-xyz/PerkOS-Buy-A-Coffee">Source on GitHub</a>
      </div>

      <h2>How it works</h2>
      <ol className="dim" style={{ paddingLeft: "1.2rem" }}>
        <li>Sign in with your email, pick a handle, paste the wallet that should receive coffees.</li>
        <li>Put the button on your site, or the badge in your README. Both link to <code>buyacoffee.perkos.xyz/your-handle</code>.</li>
        <li>A donor picks 5, 10, 50 or a custom amount, signs once, and is sent back to your site with the result.</li>
      </ol>

      <h2>Add it to a site</h2>
      <pre className="snip">{`<script src="${cfg.appUrl}/widget.js" data-handle="your-handle" data-amount="5"></script>`}</pre>
      <h2>Add it to a README</h2>
      <pre className="snip">{`[![Buy me an x402 coffee](${cfg.appUrl}/badge/your-handle.svg)](${cfg.appUrl}/your-handle)`}</pre>
      <h2>React</h2>
      <pre className="snip">{`npm i @perkos/buy-a-coffee
import { BuyACoffee } from "@perkos/buy-a-coffee/react";
<BuyACoffee handle="your-handle" amount={5} />`}</pre>

      <p className="note" style={{ marginTop: "2rem" }}>
        Settlement contract: CoffeeSplit on {cfg.networkName} · <code>{cfg.coffeeSplit}</code>. Facilitator: stack.perkos.xyz.
      </p>
    </main>
  );
}

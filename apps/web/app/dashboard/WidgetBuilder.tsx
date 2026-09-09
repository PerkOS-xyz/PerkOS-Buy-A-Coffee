"use client";

import { useEffect, useMemo, useState } from "react";
import { BUTTON_STYLE, createCoffeeLink } from "@perkos/buy-a-coffee";

type Theme = "auto" | "light" | "dark";
type Tab = "script" | "react" | "link" | "badge";

export default function WidgetBuilder({ wallet, appUrl, initialName }: { wallet: string; appUrl: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [label, setLabel] = useState("Buy me an x402 coffee");
  const [theme, setTheme] = useState<Theme>("auto");
  const [amount, setAmount] = useState<string>("5");
  const [memo, setMemo] = useState("");
  const [pageBg, setPageBg] = useState<"dark" | "light">("dark");
  const [tab, setTab] = useState<Tab>("script");
  const [copied, setCopied] = useState(false);

  // The preview uses the widget's own stylesheet, so it matches the real button.
  useEffect(() => {
    if (document.getElementById("perkos-coffee-style")) return;
    const s = document.createElement("style");
    s.id = "perkos-coffee-style";
    s.textContent = BUTTON_STYLE;
    document.head.appendChild(s);
  }, []);

  const amt = amount && Number.isFinite(Number(amount)) && Number(amount) > 0 ? Number(amount) : undefined;
  const link = useMemo(
    () => createCoffeeLink({ wallet, name: name || undefined, amount: amt, memo: memo || undefined, returnTo: "https://your-site.example/page", baseUrl: appUrl }),
    [wallet, name, amt, memo, appUrl],
  );
  const effectiveTheme = theme === "auto" ? (pageBg === "light" ? "light" : "dark") : theme;

  const attrs = [
    `data-wallet="${wallet}"`,
    name ? `data-name="${escapeAttr(name)}"` : "",
    amt ? `data-amount="${amt}"` : "",
    memo ? `data-memo="${escapeAttr(memo)}"` : "",
    label !== "Buy me an x402 coffee" ? `data-label="${escapeAttr(label)}"` : "",
    theme !== "auto" ? `data-theme="${theme}"` : "",
  ].filter(Boolean);

  const snippets: Record<Tab, string> = {
    script: `<script src="${appUrl}/widget.js"\n  ${attrs.join("\n  ")}></script>`,
    react: `import { BuyACoffee } from "@perkos/buy-a-coffee/react";\n\n<BuyACoffee\n  wallet="${wallet}"${name ? `\n  name="${escapeAttr(name)}"` : ""}${amt ? `\n  amount={${amt}}` : ""}${memo ? `\n  memo="${escapeAttr(memo)}"` : ""}${label !== "Buy me an x402 coffee" ? `\n  label="${escapeAttr(label)}"` : ""}${theme !== "auto" ? `\n  theme="${theme}"` : ""}\n  onResult={(r) => console.log(r)}\n/>`,
    link: `${appUrl}/pay?to=${wallet}${name ? `&name=${encodeURIComponent(name)}` : ""}${amt ? `&amount=${amt}` : ""}${memo ? `&memo=${encodeURIComponent(memo)}` : ""}`,
    badge: `[![${escapeAttr(label)}](${appUrl}/badge/${wallet}.svg)](${appUrl}/pay?to=${wallet}${name ? `&name=${encodeURIComponent(name)}` : ""})`,
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippets[tab]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: "1rem" }}>
      <div className="lbl">Widget builder</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: "1.5rem", marginTop: ".8rem" }}>
        <div>
          <label className="f" htmlFor="wb-name">Name shown on the checkout</label>
          <input id="wb-name" type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <label className="f" htmlFor="wb-label">Button label</label>
          <input id="wb-label" type="text" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />
          <label className="f" htmlFor="wb-amount">Suggested amount (USDC)</label>
          <div className="row">
            {["", "5", "10", "50"].map((a) => (
              <button key={a || "none"} type="button" className={`amt ${amount === a ? "on" : ""}`} style={{ padding: ".45rem .8rem" }} onClick={() => setAmount(a)}>
                {a ? `$${a}` : "none"}
              </button>
            ))}
            <input id="wb-amount" type="number" min={1} max={1000} step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="custom" style={{ maxWidth: "7rem" }} />
          </div>
          <label className="f" htmlFor="wb-memo">Prefilled message (optional)</label>
          <input id="wb-memo" type="text" maxLength={140} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="" />
          <label className="f">Theme</label>
          <div className="row">
            {(["auto", "light", "dark"] as Theme[]).map((t) => (
              <button key={t} type="button" className={`amt ${theme === t ? "on" : ""}`} style={{ padding: ".45rem .8rem" }} onClick={() => setTheme(t)}>{t}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="f">Preview on a {pageBg} page</label>
          <div
            style={{
              background: pageBg === "light" ? "#ffffff" : "#0c0f13",
              color: pageBg === "light" ? "#1b1f24" : "#e9e4d9",
              border: "1px solid var(--rule)",
              borderRadius: 6,
              padding: "1.6rem",
              minHeight: "9rem",
              display: "flex",
              flexDirection: "column",
              gap: ".8rem",
              alignItems: "flex-start",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <span style={{ opacity: 0.6, fontSize: ".85rem" }}>Your page content…</span>
            <a className="perkos-coffee" data-theme={effectiveTheme} href={link} target="_blank" rel="noreferrer">
              <span className="perkos-coffee-cup" aria-hidden="true">☕</span>
              {label || "Buy me an x402 coffee"}
            </a>
            <span style={{ opacity: 0.6, fontSize: ".8rem" }}>Badge for READMEs:</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${appUrl}/badge/${wallet}.svg`} alt="badge preview" height={20} />
          </div>
          <div className="row" style={{ marginTop: ".6rem" }}>
            <button type="button" className={`amt ${pageBg === "dark" ? "on" : ""}`} style={{ padding: ".35rem .7rem" }} onClick={() => setPageBg("dark")}>dark page</button>
            <button type="button" className={`amt ${pageBg === "light" ? "on" : ""}`} style={{ padding: ".35rem .7rem" }} onClick={() => setPageBg("light")}>light page</button>
            <a className="note" href={link} target="_blank" rel="noreferrer">Open the checkout this button links to ↗</a>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: "1.2rem", gap: ".4rem" }}>
        {(["script", "react", "link", "badge"] as Tab[]).map((t) => (
          <button key={t} type="button" className={`amt ${tab === t ? "on" : ""}`} style={{ padding: ".4rem .8rem" }} onClick={() => setTab(t)}>
            {t === "script" ? "Script tag" : t === "react" ? "React" : t === "link" ? "Plain link" : "GitHub badge"}
          </button>
        ))}
        <button type="button" className="btn ghost" style={{ marginLeft: "auto", padding: ".4rem .9rem" }} onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre className="snip" style={{ marginTop: ".6rem" }}>{snippets[tab]}</pre>
      <p className="note">
        {tab === "script" ? "Paste where the button should appear. The script renders the button in place and reports the donor's return." : tab === "react" ? "npm i @perkos/buy-a-coffee" : tab === "link" ? "Use anywhere a link works: email signatures, bios, chat." : "Markdown for GitHub READMEs and profiles."}
      </p>
    </section>
  );
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

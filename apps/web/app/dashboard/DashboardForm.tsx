"use client";

import { useState } from "react";

type Values = { handle: string; payTo: string; displayName: string; avatarUrl: string; message: string; amounts: string; allowedOrigins: string };

export default function DashboardForm({ initial, appUrl }: { initial: Values; appUrl: string }) {
  const [v, setV] = useState<Values>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  async function useConnectedWallet() {
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum;
    if (!eth) {
      setError("No browser wallet found");
      return;
    }
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    if (accounts[0]) setV({ ...v, payTo: accounts[0] });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    const amounts = v.amounts.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0).slice(0, 4);
    const body = {
      handle: v.handle.trim().toLowerCase() || undefined,
      payTo: v.payTo.trim() || undefined,
      displayName: v.displayName.trim(),
      avatarUrl: v.avatarUrl.trim(),
      message: v.message.trim(),
      amounts: amounts.length ? amounts : undefined,
      allowedOrigins: v.allowedOrigins.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    const r = await fetch("/api/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setState("saved");
      window.location.reload();
    } else {
      setError(j.error || "Could not save");
      setState("error");
    }
  }

  return (
    <form onSubmit={save} className="card">
      <div className="lbl">Your page</div>
      <label className="f" htmlFor="handle">Handle</label>
      <div className="row">
        <span className="note">{appUrl}/</span>
        <input id="handle" type="text" value={v.handle} onChange={set("handle")} placeholder="your-handle" style={{ maxWidth: "16rem" }} required />
      </div>
      <label className="f" htmlFor="payTo">Receiving wallet (USDC on Base)</label>
      <div className="row">
        <input id="payTo" type="text" value={v.payTo} onChange={set("payTo")} placeholder="0x…" style={{ maxWidth: "32rem" }} required />
        <button type="button" className="btn ghost" onClick={useConnectedWallet}>Use connected wallet</button>
      </div>
      <label className="f" htmlFor="displayName">Display name</label>
      <input id="displayName" type="text" value={v.displayName} onChange={set("displayName")} maxLength={80} />
      <label className="f" htmlFor="avatarUrl">Avatar URL</label>
      <input id="avatarUrl" type="url" value={v.avatarUrl} onChange={set("avatarUrl")} placeholder="https://…/you.jpg" />
      <label className="f" htmlFor="message">Message shown on your page</label>
      <textarea id="message" value={v.message} onChange={set("message")} maxLength={280} rows={2} />
      <label className="f" htmlFor="amounts">Suggested amounts (USDC, comma separated, up to 4)</label>
      <input id="amounts" type="text" value={v.amounts} onChange={set("amounts")} placeholder="5, 10, 50" style={{ maxWidth: "16rem" }} />
      <label className="f" htmlFor="allowedOrigins">Allowed origins for return (one per line)</label>
      <textarea id="allowedOrigins" value={v.allowedOrigins} onChange={set("allowedOrigins")} rows={3} placeholder={"https://your-site.com\nhttps://www.your-site.com"} />
      <div className="row" style={{ marginTop: "1.2rem" }}>
        <button className="btn" type="submit" disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save"}</button>
        {state === "saved" ? <span className="msg ok">Saved</span> : null}
      </div>
      {error ? <p className="msg err">{error}</p> : null}
    </form>
  );
}

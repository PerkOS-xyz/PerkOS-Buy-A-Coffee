"use client";

import { useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const r = await fetch("/api/auth/magic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) setState("sent");
    else {
      setError(j.error || "Could not send the link");
      setState("error");
    }
  }

  if (state === "sent") return <p className="msg ok">Check {email} for your sign-in link. It works once and expires in 15 minutes.</p>;

  return (
    <form onSubmit={submit} className="card" style={{ marginTop: "1.5rem", maxWidth: "28rem" }}>
      <label className="f" htmlFor="email">Email</label>
      <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="btn" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a link"}</button>
      </div>
      {error ? <p className="msg err">{error}</p> : null}
    </form>
  );
}

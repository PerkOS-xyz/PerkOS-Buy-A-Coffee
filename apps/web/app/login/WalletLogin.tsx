"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

type Step = "idle" | "connecting" | "signing" | "verifying" | "done" | "error";

export default function WalletLogin() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const wallet = wallets.find((w) => /^0x[0-9a-fA-F]{40}$/.test(w.address));

  useEffect(() => {
    if (!ready || !walletsReady || !authenticated || !wallet || started.current) return;
    started.current = true;
    (async () => {
      try {
        setStep("signing");
        const c = await fetch("/api/auth/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: wallet.address }),
        }).then((r) => r.json());
        if (!c.ok) throw new Error(c.error || "Could not start sign-in");
        const signature = await wallet.sign(c.message);
        setStep("verifying");
        const v = await fetch("/api/auth/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: wallet.address, token: c.token, signature }),
        }).then((r) => r.json());
        if (!v.ok) throw new Error(v.error || "Signature rejected");
        setStep("done");
        window.location.href = "/dashboard";
      } catch (e: unknown) {
        started.current = false;
        setError((e as Error).message || "Sign-in failed");
        setStep("error");
      }
    })();
  }, [ready, walletsReady, authenticated, wallet]);

  return (
    <div className="card" style={{ marginTop: "1.5rem", maxWidth: "28rem" }}>
      {!authenticated ? (
        <button className="btn" type="button" disabled={!ready} onClick={() => { setStep("connecting"); login(); }}>
          {step === "connecting" ? "Opening wallet…" : "Connect wallet"}
        </button>
      ) : (
        <>
          <p className="note">
            {wallet ? <>Connected: {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</> : "Waiting for an Ethereum wallet…"}
          </p>
          <p className="note">
            {step === "signing" ? "Sign the message in your wallet to prove ownership (no transaction)." : step === "verifying" ? "Verifying…" : step === "done" ? "Signed in." : ""}
          </p>
          <div className="row" style={{ marginTop: ".6rem" }}>
            {step === "error" ? <button className="btn" type="button" onClick={() => { setError(null); started.current = false; setStep("idle"); }}>Try again</button> : null}
            <button className="btn ghost" type="button" onClick={() => logout()}>Disconnect</button>
          </div>
        </>
      )}
      {error ? <p className="msg err">{error}</p> : null}
    </div>
  );
}

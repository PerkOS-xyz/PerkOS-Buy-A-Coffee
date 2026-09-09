"use client";

import dynamic from "next/dynamic";

// Uses Privy hooks, so it must only render where the provider exists: the browser.
const WalletLogin = dynamic(() => import("./WalletLogin"), { ssr: false, loading: () => <p className="note">Loading wallet sign-in…</p> });

export default function LoginClient() {
  return <WalletLogin />;
}

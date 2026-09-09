"use client";

export function NavAuth({ wallet }: { wallet: string | null }) {
  if (!wallet) return <a href="/login">Sign in with wallet</a>;
  return (
    <span className="row" style={{ gap: ".8rem" }}>
      <a href="/dashboard">{wallet.slice(0, 6)}…{wallet.slice(-4)}</a>
      <form action="/api/auth/logout" method="post" style={{ display: "inline" }}>
        <button type="submit" className="btn ghost" style={{ padding: ".3rem .7rem" }}>Sign out</button>
      </form>
    </span>
  );
}

import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  const enabled = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  return (
    <main className="wrap">
      <div className="lbl">Creators and donors</div>
      <h1>Sign in with your wallet</h1>
      <p className="dim">See the coffees you received and the ones you sent, straight from the chain. Claim a handle for a profile page if you want one.</p>
      {q.error ? <p className="msg err">{q.error === "signature" ? "The signature could not be verified. Try again." : "Sign-in failed. Try again."}</p> : null}
      {enabled ? <LoginClient /> : <p className="msg err">Wallet sign-in is not configured on this deployment (NEXT_PUBLIC_PRIVY_APP_ID).</p>}
    </main>
  );
}

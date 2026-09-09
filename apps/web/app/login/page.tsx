import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  return (
    <main className="wrap">
      <div className="lbl">Creators</div>
      <h1>Sign in</h1>
      <p className="dim">We email you a one-time link. No password.</p>
      {q.error === "expired" ? <p className="msg err">That link expired or was already used. Request a new one.</p> : null}
      <LoginForm />
    </main>
  );
}

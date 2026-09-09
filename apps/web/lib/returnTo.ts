// `return_to` safety: the checkout only redirects back to origins the creator
// listed (or the app itself). Anything else is shown as a link, never followed.

export function normalizeOrigin(value: string): string | null {
  try {
    const u = new URL(value.includes("://") ? value : `https://${value}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function isAllowedReturnTo(returnTo: string | null | undefined, allowedOrigins: string[], appUrl: string): boolean {
  if (!returnTo) return false;
  let u: URL;
  try {
    u = new URL(returnTo);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const origin = u.origin.toLowerCase();
  if (origin === normalizeOrigin(appUrl)) return true;
  return allowedOrigins.map(normalizeOrigin).filter(Boolean).includes(origin);
}

/** Appends the coffee result to a return URL, replacing any previous `coffee`/`tx`/`amount` params. */
export function withResult(returnTo: string, result: { status: "paid" | "cancelled" | "failed"; tx?: string | null; amount?: string }): string {
  const u = new URL(returnTo);
  u.searchParams.delete("coffee");
  u.searchParams.delete("tx");
  u.searchParams.delete("amount");
  u.searchParams.set("coffee", result.status);
  if (result.tx) u.searchParams.set("tx", result.tx);
  if (result.amount) u.searchParams.set("amount", result.amount);
  return u.toString();
}

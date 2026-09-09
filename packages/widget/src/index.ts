/**
 * @perkos/buy-a-coffee — the light side of PerkOS Buy A Coffee.
 *
 * The widget never touches a wallet. It builds a link to the hosted checkout
 * (buyacoffee.perkos.xyz/{handle}), sends the donor there with `return_to`
 * set to the current page, and reads the result back from the URL when the
 * donor returns (`?coffee=paid|cancelled|failed&tx=…&amount=…`).
 */

export const DEFAULT_BASE_URL = "https://buyacoffee.perkos.xyz";

export interface CoffeeLinkOptions {
  /** Creator handle on buyacoffee.perkos.xyz. */
  handle: string;
  /** Preselected amount in USDC (the donor can change it). */
  amount?: number;
  /** Optional message, up to 140 characters. */
  memo?: string;
  /** Where to send the donor back. Defaults to the current page URL in the browser. */
  returnTo?: string;
  /** Override the service base URL (self-hosted or staging). */
  baseUrl?: string;
}

export type CoffeeStatus = "paid" | "cancelled" | "failed";

export interface CoffeeResult {
  status: CoffeeStatus;
  tx: string | null;
  amount: number | null;
}

export const RESULT_EVENT = "perkos:coffee";

function baseUrl(opt?: { baseUrl?: string }): string {
  return (opt?.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
}

/** Builds the checkout URL. Safe to call on the server (no `window` needed when `returnTo` is given). */
export function createCoffeeLink(opt: CoffeeLinkOptions): string {
  if (!opt.handle || !/^[a-z0-9-]{1,32}$/i.test(opt.handle)) throw new Error("createCoffeeLink: invalid handle");
  const u = new URL(`${baseUrl(opt)}/${opt.handle.toLowerCase()}`);
  const returnTo = opt.returnTo ?? (typeof window !== "undefined" ? window.location.href : undefined);
  if (returnTo) u.searchParams.set("return_to", stripResult(returnTo));
  if (opt.amount && Number.isFinite(opt.amount) && opt.amount > 0) u.searchParams.set("amount", String(opt.amount));
  if (opt.memo) u.searchParams.set("memo", opt.memo.slice(0, 140));
  return u.toString();
}

/** Removes a previous coffee result from a URL so it is not carried into the next round trip. */
export function stripResult(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("coffee");
    u.searchParams.delete("tx");
    u.searchParams.delete("amount");
    return u.toString();
  } catch {
    return url;
  }
}

/** Parses a coffee result from a URL (or the current location). */
export function parseResult(url?: string): CoffeeResult | null {
  const href = url ?? (typeof window !== "undefined" ? window.location.href : "");
  if (!href) return null;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const status = u.searchParams.get("coffee");
  if (status !== "paid" && status !== "cancelled" && status !== "failed") return null;
  const tx = u.searchParams.get("tx");
  const amountRaw = u.searchParams.get("amount");
  const amount = amountRaw && Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : null;
  return { status, tx: tx && /^0x[0-9a-fA-F]{64}$/.test(tx) ? tx : null, amount };
}

/**
 * In the browser: if the current URL carries a coffee result, clean the URL
 * (history.replaceState) and dispatch `perkos:coffee` on `window`. Returns the result.
 */
export function consumeResult(): CoffeeResult | null {
  if (typeof window === "undefined") return null;
  const result = parseResult();
  if (!result) return null;
  const clean = stripResult(window.location.href);
  if (clean !== window.location.href) window.history.replaceState(window.history.state, "", clean);
  window.dispatchEvent(new CustomEvent<CoffeeResult>(RESULT_EVENT, { detail: result }));
  return result;
}

/** Subscribe to results; returns an unsubscribe function. */
export function onCoffeeResult(handler: (r: CoffeeResult) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = (e: Event) => handler((e as CustomEvent<CoffeeResult>).detail);
  window.addEventListener(RESULT_EVENT, fn);
  return () => window.removeEventListener(RESULT_EVENT, fn);
}

export interface ButtonOptions extends CoffeeLinkOptions {
  label?: string;
  theme?: "light" | "dark" | "auto";
}

export const BUTTON_STYLE = `
.perkos-coffee{display:inline-flex;align-items:center;gap:.5em;padding:.6em 1.1em;border-radius:6px;border:1.5px solid #e0a145;background:#e0a145;color:#0c0f13;font:600 14px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;text-decoration:none;cursor:pointer;transition:transform .12s ease,background .12s ease}
.perkos-coffee:hover{background:#f0b35a;transform:translateY(-1px)}
.perkos-coffee[data-theme="light"]{background:#fff;color:#0c0f13;border-color:#0c0f13}
.perkos-coffee[data-theme="light"]:hover{background:#f4f4f4}
.perkos-coffee .perkos-coffee-cup{font-size:1.1em;line-height:1}
`;

/** Creates the anchor element used by the script tag and the React wrapper. */
export function createButton(opt: ButtonOptions): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className = "perkos-coffee";
  a.href = createCoffeeLink(opt);
  a.rel = "noopener";
  a.setAttribute("data-theme", resolveTheme(opt.theme));
  const cup = document.createElement("span");
  cup.className = "perkos-coffee-cup";
  cup.setAttribute("aria-hidden", "true");
  cup.textContent = "☕";
  a.appendChild(cup);
  a.appendChild(document.createTextNode(opt.label || "Buy me an x402 coffee"));
  // Recompute the link at click time so return_to is the page as it is now.
  a.addEventListener("click", () => {
    a.href = createCoffeeLink(opt);
  });
  return a;
}

export function resolveTheme(theme?: "light" | "dark" | "auto"): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

let styleInjected = false;
export function injectStyle(doc: Document = document): void {
  if (styleInjected || doc.getElementById("perkos-coffee-style")) return;
  const s = doc.createElement("style");
  s.id = "perkos-coffee-style";
  s.textContent = BUTTON_STYLE;
  doc.head.appendChild(s);
  styleInjected = true;
}

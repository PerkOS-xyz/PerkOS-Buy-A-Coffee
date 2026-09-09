// <script src="https://buyacoffee.perkos.xyz/widget.js" data-handle="…" data-amount="5" data-network="base" data-label="…" data-theme="auto">
// Renders the button in place of the script tag and reports a returning donor's result.
import { consumeResult, createButton, createCoffeeLink, injectStyle, onCoffeeResult, parseResult } from "./index";

function mount(script: HTMLScriptElement) {
  const handle = script.dataset.handle;
  const wallet = script.dataset.wallet;
  if (!handle && !wallet) {
    console.warn("[perkos-coffee] missing data-handle or data-wallet");
    return;
  }
  injectStyle();
  const amount = script.dataset.amount ? Number(script.dataset.amount) : undefined;
  const theme = (script.dataset.theme as "light" | "dark" | "auto" | undefined) || "auto";
  const a = createButton({
    handle,
    wallet,
    name: script.dataset.name,
    amount: amount && Number.isFinite(amount) ? amount : undefined,
    memo: script.dataset.memo,
    network: script.dataset.network,
    label: script.dataset.label,
    theme,
    baseUrl: script.dataset.baseUrl || new URL(script.src).origin,
  });
  const target = script.dataset.target ? document.querySelector(script.dataset.target) : null;
  if (target) target.appendChild(a);
  else script.parentNode?.insertBefore(a, script);
}

const current = document.currentScript as HTMLScriptElement | null;
if (current) mount(current);
else document.querySelectorAll<HTMLScriptElement>("script[src*='widget.js'][data-handle], script[src*='widget.js'][data-wallet]").forEach(mount);

// Returning donor: clean the URL and announce the result.
const result = consumeResult();
if (result) {
  const banner = document.currentScript?.dataset.thanks ?? current?.dataset.thanks;
  if (banner !== "off" && result.status === "paid") {
    const el = document.createElement("div");
    el.setAttribute("role", "status");
    el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0c0f13;color:#e9e4d9;border:1px solid #e0a145;border-radius:6px;padding:.7em 1.1em;font:14px/1.3 system-ui,sans-serif;z-index:2147483647;box-shadow:0 8px 30px rgba(0,0,0,.4)";
    el.textContent = `☕ Thanks for the coffee${result.amount ? ` ($${result.amount})` : ""}!`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }
}

export { createCoffeeLink, onCoffeeResult, parseResult };

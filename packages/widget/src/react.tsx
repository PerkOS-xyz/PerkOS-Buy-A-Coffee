import { useEffect, useMemo } from "react";
import { consumeResult, createCoffeeLink, injectStyle, onCoffeeResult, resolveTheme, type CoffeeLinkOptions, type CoffeeResult } from "./index";

export interface BuyACoffeeProps extends CoffeeLinkOptions {
  label?: string;
  theme?: "light" | "dark" | "auto";
  className?: string;
  /** Called when the donor comes back to this page with a result. */
  onResult?: (result: CoffeeResult) => void;
}

/**
 * A link-styled button that sends the donor to the hosted checkout and
 * reports the result when they come back. No wallet code in your bundle.
 */
export function BuyACoffee({ label, theme, className, onResult, ...link }: BuyACoffeeProps) {
  useEffect(() => {
    injectStyle();
    const off = onResult ? onCoffeeResult(onResult) : () => {};
    consumeResult();
    return off;
  }, [onResult]);

  const href = useMemo(() => {
    try {
      return createCoffeeLink({ ...link, returnTo: link.returnTo ?? (typeof window !== "undefined" ? window.location.href : undefined) });
    } catch {
      return "#";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.handle, link.wallet, link.name, link.amount, link.memo, link.returnTo, link.baseUrl]);

  return (
    <a
      className={`perkos-coffee${className ? ` ${className}` : ""}`}
      data-theme={resolveTheme(theme)}
      href={href}
      rel="noopener"
      onClick={(e) => {
        // Recompute at click time so return_to reflects the current URL.
        (e.currentTarget as HTMLAnchorElement).href = createCoffeeLink(link);
      }}
    >
      <span className="perkos-coffee-cup" aria-hidden="true">☕</span>
      {label || "Buy me an x402 coffee"}
    </a>
  );
}

export { createCoffeeLink, onCoffeeResult, consumeResult };
export type { CoffeeResult };

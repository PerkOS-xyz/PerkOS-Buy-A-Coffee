"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Privy only runs in the browser (same pattern as the PerkOS app): the
// provider is loaded with ssr:false so prerendering never touches it.
const PrivyOuter = dynamic(() => import("./PrivyOuter").then((m) => m.PrivyOuter), { ssr: false });

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

export function Providers({ children }: { children: ReactNode }) {
  if (!APP_ID) return <>{children}</>;
  return <PrivyOuter>{children}</PrivyOuter>;
}

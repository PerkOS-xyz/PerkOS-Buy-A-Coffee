"use client";

import type { ReactNode } from "react";
import { PrivyOuter } from "./PrivyOuter";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

// PrivyProvider is SSR-safe as a client component; children always render on
// the server (a dynamic ssr:false wrapper here would blank the whole page).
export function Providers({ children }: { children: ReactNode }) {
  if (!APP_ID) return <>{children}</>;
  return <PrivyOuter>{children}</PrivyOuter>;
}

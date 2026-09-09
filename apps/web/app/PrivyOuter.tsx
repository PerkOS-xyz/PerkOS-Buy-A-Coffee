"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { base, baseSepolia } from "viem/chains";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
const CLIENT_ID = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || "";

export function PrivyOuter({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={APP_ID}
      clientId={CLIENT_ID || undefined}
      config={{
        loginMethodsAndOrder: {
          primary: ["metamask", "coinbase_wallet", "base_account", "wallet_connect_qr"],
          overflow: ["detected_ethereum_wallets"],
        },
        supportedChains: [base, baseSepolia],
        defaultChain: process.env.NEXT_PUBLIC_NETWORK === "base" ? base : baseSepolia,
        embeddedWallets: { ethereum: { createOnLogin: "off" } },
        appearance: {
          theme: "dark",
          accentColor: "#e0a145",
          showWalletLoginFirst: true,
          walletList: ["metamask", "coinbase_wallet", "base_account", "detected_ethereum_wallets", "wallet_connect_qr"],
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

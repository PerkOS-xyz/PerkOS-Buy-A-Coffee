import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buy A Coffee · PerkOS",
  description: "One-click USDC coffees for creators, settled over x402 by the PerkOS facilitator. No account for donors, 2% fee, funds land in the creator's wallet instantly.",
  metadataBase: new URL(process.env.APP_URL || "https://buyacoffee.perkos.xyz"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,300&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="top">
          <a className="brand" href="/">☕ Buy A Coffee <span style={{ color: "var(--paper-faint)" }}>· PerkOS</span></a>
          <nav className="row">
            <a href="/dashboard">Dashboard</a>
          </nav>
        </div>
        {children}
      </body>
    </html>
  );
}

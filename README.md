# PerkOS Buy A Coffee

Buy A Coffee for the x402 era. A creator gets a hosted page at `buyacoffee.perkos.xyz/{handle}`; a donor picks 5, 10, 50 or a custom amount of USDC, signs **once** in their wallet, pays no gas, and is sent back to the site they came from. The PerkOS facilitator ([Stack](https://stack.perkos.xyz)) settles through the `CoffeeSplit` contract: **98% to the creator instantly, 2% covers the facilitator's gas**. No custody, no account for donors.

Design: `BUY-A-COFFEE-DESIGN.md` in the PerkOS workspace. Contract: [PerkOS-Contracts `CoffeeSplit`](https://github.com/PerkOS-xyz/PerkOS-Contracts). Facilitator route: [Stack `Docs/COFFEE_SPLIT.md`](https://github.com/PerkOS-xyz/Stack).

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js 15 service: checkout `/pay?to=…` and `/{handle}`, badge `/badge/{wallet-or-handle}.svg`, wallet dashboard, API. Privy wallet sign-in, viem, Neon Postgres (optional). |
| `packages/widget` | `@perkos/buy-a-coffee`: script tag, React component, `createCoffeeLink()`. No web3 dependencies. |

## Use it on a site

Wallet mode, no account: the widget carries the receiving wallet and the service settles straight to it.

```html
<script src="https://buyacoffee.perkos.xyz/widget.js" data-wallet="0xYourWallet" data-name="Your Name" data-amount="5"></script>
```

Handle mode, with a registered creator (profile page, dashboard, automatic return to your site):

```html
<script src="https://buyacoffee.perkos.xyz/widget.js" data-handle="your-handle" data-amount="5"></script>
```

React:

```tsx
import { BuyACoffee } from "@perkos/buy-a-coffee/react";
<BuyACoffee wallet="0xYourWallet" name="Your Name" amount={5} onResult={(r) => console.log(r)} />
// or <BuyACoffee handle="your-handle" amount={5} />
```

GitHub README:

```md
[![Buy me an x402 coffee](https://buyacoffee.perkos.xyz/badge/0xYourWallet.svg)](https://buyacoffee.perkos.xyz/pay?to=0xYourWallet&name=Your%20Name)
<!-- or, with a handle: /badge/your-handle.svg → /your-handle -->
```

When the donor returns, the URL carries `?coffee=paid&tx=0x…&amount=5` (or `coffee=cancelled`). The widget cleans the URL and dispatches `perkos:coffee` on `window`. In handle mode the checkout redirects automatically, but only to origins the creator listed in the dashboard; in wallet mode there is no origin list, so the donor gets a "Back to your-site" button instead (no open redirect).

## Dashboard

Sign in with a wallet (Privy) and the dashboard lists coffees **received** (`Coffee` events where `creator` = wallet) and **sent** (`from` = wallet) directly from the CoffeeSplit contract, plus ready-to-copy snippets for that wallet. With a database, a handle/profile page can be claimed too.

## Flow

1. `POST /api/checkout/prepare` (with `handle` or `payTo`) returns the EIP-3009 `ReceiveWithAuthorization` typed data (`to = CoffeeSplit`, `nonce = coffeeNonce(payTo, coffeeId)`, 10-minute window).
2. The donor signs in the browser (EIP-6963 injected wallets; chain switch to Base if needed).
3. `POST /api/checkout/settle` re-derives the authorization server-side (the nonce binds `payTo` + `coffeeId`, so the recipient cannot be swapped), calls Stack `verify` then `settle` with `paymentRequirements.extra.split`; the sponsor wallet executes `CoffeeSplit.settle(...)`. The coffee is recorded as `settled`/`failed`; in wallet mode the database is optional (best-effort record).
4. Redirect to `return_to` with the result.

## Run locally

```bash
npm install
cp apps/web/.env.example apps/web/.env   # SESSION_SECRET required; DATABASE_URL and NEXT_PUBLIC_PRIVY_APP_ID optional locally
npm run db:migrate -w apps/web
npm run build -w packages/widget
npm run dev
```

`npm test` runs the pure unit tests (return_to safety, nonce/memo helpers, widget link parsing). `npm run typecheck` covers both packages.

## Deploy (Vercel)

Project `zknexus/buyacoffee` (root `apps/web`, linked to this repo, production branch `main`). Domain `buyacoffee.perkos.xyz` is added to the project; DNS lives in Route 53 for `perkos.xyz`:

```
buyacoffee.perkos.xyz.  CNAME  95763684bb574e41.vercel-dns-016.com.   (or cname.vercel-dns.com.)
```

Env already set (production, preview, development): `APP_URL`, `NETWORK=base-sepolia`, `COFFEE_SPLIT_ADDRESS`, `RPC_URL`, `PERKOS_STACK_URL`, `SESSION_SECRET`.

Still needed before the first coffee:

1. **Database**: create a Neon Postgres (Vercel Marketplace → Neon, or neon.tech), set `DATABASE_URL` on the project, then run `DATABASE_URL=… npm run db:migrate -w apps/web` once. The migrations also seed the first creator, `juliomcruz` (pay-to `0xc2564e41B7F5Cb66d2d99466450CfebcE9e8228f`, allowed origins juliomcruz.xyz and github.com).
2. **Sign-in**: `NEXT_PUBLIC_PRIVY_APP_ID` (the PerkOS Privy app is reused) and `https://buyacoffee.perkos.xyz` added to that app's allowed origins in the Privy dashboard. Sessions are proven by a signed challenge (`/api/auth/challenge` → `/api/auth/wallet`); no Privy server secret.
3. **Stack** (facilitator): merge PerkOS-xyz/Stack PR #147; `COFFEE_SPLIT_ADDRESS_BASE_SEPOLIA` is already set on the `stack` project. In the Stack dashboard create an API key, claim and verify the vendor domain `buyacoffee.perkos.xyz`, and add a `domain_whitelist` sponsor rule for it pointing at a funded sponsor wallet on Base Sepolia. Set that key here as `PERKOS_STACK_API_KEY`.
4. **DNS**: the CNAME above.

Build: `npm run build` from the repo root (builds the widget first, then Next). Env reference: `apps/web/.env.example`.

## Not in v1

Other networks and tokens, WalletConnect (injected wallets only), recurring coffees, embedded (non-redirect) checkout, fiat.

## Contracts

| Network | CoffeeSplit proxy | From block |
|---|---|---|
| Base mainnet | `0xf8aaa69ef77d91dd4419d883252d3d0f0fd09d90` | 51103530 |
| Base Sepolia | `0x704F85Bca00617096fa4F3d5C5499Ff373Fd5d38` | 46581089 |

Both verified on Basescan. `NETWORK=base` selects mainnet; `COFFEE_SPLIT_ADDRESS` and `COFFEE_SPLIT_FROM_BLOCK` override the defaults.

## Operations

- **Gas.** Stack settles every coffee from the PerkOS sponsor wallet (`SPONSOR_WALLET_ADDRESS`). `GET /api/health` reports its balance on the configured network and flags `sponsorLow` under `SPONSOR_LOW_ETH`; the daily Vercel cron (`vercel.json`) calls it with `?alert=1`, which posts to `ALERT_WEBHOOK_URL` (Slack/Discord-style JSON with `text`) when low. Refill from the treasury: the 2% fee arrives in USDC, gas is paid in ETH.
- **Rate limits.** `POST /api/checkout/prepare` and `POST /api/checkout/settle` are limited per IP and per payer wallet (see `lib/rateLimit.ts`; settle is tighter because it spends sponsor gas). In-memory per instance; promote to a database-backed limiter if abuse shows up.

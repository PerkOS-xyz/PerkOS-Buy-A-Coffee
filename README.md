# PerkOS Buy A Coffee

Buy A Coffee for the x402 era. A creator gets a hosted page at `buyacoffee.perkos.xyz/{handle}`; a donor picks 5, 10, 50 or a custom amount of USDC, signs **once** in their wallet, pays no gas, and is sent back to the site they came from. The PerkOS facilitator ([Stack](https://stack.perkos.xyz)) settles through the `CoffeeSplit` contract: **98% to the creator instantly, 2% covers the facilitator's gas**. No custody, no account for donors.

Design: `BUY-A-COFFEE-DESIGN.md` in the PerkOS workspace. Contract: [PerkOS-Contracts `CoffeeSplit`](https://github.com/PerkOS-xyz/PerkOS-Contracts). Facilitator route: [Stack `Docs/COFFEE_SPLIT.md`](https://github.com/PerkOS-xyz/Stack).

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js 15 service: checkout `/{handle}`, badge `/badge/{handle}.svg`, creator dashboard, API. Neon Postgres, Resend magic links, viem. |
| `packages/widget` | `@perkos/buy-a-coffee`: script tag, React component, `createCoffeeLink()`. No web3 dependencies. |

## Use it on a site

```html
<script src="https://buyacoffee.perkos.xyz/widget.js" data-handle="your-handle" data-amount="5"></script>
```

React:

```tsx
import { BuyACoffee } from "@perkos/buy-a-coffee/react";
<BuyACoffee handle="your-handle" amount={5} onResult={(r) => console.log(r)} />
```

GitHub README:

```md
[![Buy me an x402 coffee](https://buyacoffee.perkos.xyz/badge/your-handle.svg)](https://buyacoffee.perkos.xyz/your-handle)
```

When the donor returns, the URL carries `?coffee=paid&tx=0x…&amount=5` (or `coffee=cancelled`). The widget cleans the URL and dispatches `perkos:coffee` on `window`. The checkout only redirects to origins the creator listed in the dashboard.

## Flow

1. `POST /api/checkout/prepare` records a `pending` coffee and returns the EIP-3009 `ReceiveWithAuthorization` typed data (`to = CoffeeSplit`, `nonce = coffeeNonce(payTo, coffeeId)`, 10-minute window).
2. The donor signs in the browser (EIP-6963 injected wallets; chain switch to Base if needed).
3. `POST /api/checkout/settle` calls Stack `verify` then `settle` with `paymentRequirements.extra.split`; the sponsor wallet executes `CoffeeSplit.settle(...)`. The coffee becomes `settled` with the tx hash, or `failed` with the reason.
4. Redirect to `return_to` with the result.

## Run locally

```bash
npm install
cp apps/web/.env.example apps/web/.env   # fill DATABASE_URL, SESSION_SECRET, RESEND_API_KEY (optional locally: links print to the console)
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
2. **Email**: set `RESEND_API_KEY` (the key on juliomcruz-xyz is a sensitive var and cannot be copied) and a `FROM_EMAIL` on a domain verified in Resend (e.g. `Buy A Coffee <coffee@perkos.xyz>` once `perkos.xyz` is verified there).
3. **Stack** (facilitator): merge PerkOS-xyz/Stack PR #147; `COFFEE_SPLIT_ADDRESS_BASE_SEPOLIA` is already set on the `stack` project. In the Stack dashboard create an API key, claim and verify the vendor domain `buyacoffee.perkos.xyz`, and add a `domain_whitelist` sponsor rule for it pointing at a funded sponsor wallet on Base Sepolia. Set that key here as `PERKOS_STACK_API_KEY`.
4. **DNS**: the CNAME above.

Build: `npm run build` from the repo root (builds the widget first, then Next). Env reference: `apps/web/.env.example`.

## Not in v1

Other networks and tokens, WalletConnect (injected wallets only), recurring coffees, embedded (non-redirect) checkout, fiat.

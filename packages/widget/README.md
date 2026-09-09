# @perkos/buy-a-coffee

The light side of [PerkOS Buy A Coffee](https://buyacoffee.perkos.xyz): a button that sends a donor to the hosted USDC checkout and brings them back with the result. No wallet code in your bundle.

```html
<!-- wallet mode: no account, coffees go straight to this wallet -->
<script src="https://buyacoffee.perkos.xyz/widget.js" data-wallet="0xYourWallet" data-name="Your Name" data-amount="5" data-theme="auto"></script>
<!-- handle mode: registered creator -->
<script src="https://buyacoffee.perkos.xyz/widget.js" data-handle="your-handle" data-amount="5"></script>
```

```tsx
import { BuyACoffee } from "@perkos/buy-a-coffee/react";

<BuyACoffee wallet="0xYourWallet" name="Your Name" amount={5} label="Buy me an x402 coffee" onResult={(r) => r.status === "paid" && toast("Thanks!")} />
```

```ts
import { createCoffeeLink, onCoffeeResult, consumeResult } from "@perkos/buy-a-coffee";
const url = createCoffeeLink({ handle: "your-handle", amount: 10, returnTo: "https://your.site/thanks" });
onCoffeeResult((r) => console.log(r)); // { status: "paid" | "cancelled" | "failed", tx, amount }
consumeResult(); // reads ?coffee=… from the current URL, cleans it, dispatches "perkos:coffee"
```

Options: `wallet` + `name` (wallet mode) or `handle` (registered creator), `amount`, `memo`, `returnTo` (defaults to the current page), `label`, `theme` (`light` | `dark` | `auto`), `baseUrl`.

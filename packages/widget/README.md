# @perkos/buy-a-coffee

The light side of [PerkOS Buy A Coffee](https://buyacoffee.perkos.xyz): a button that sends a donor to the hosted USDC checkout and brings them back with the result. No wallet code in your bundle.

```html
<script src="https://buyacoffee.perkos.xyz/widget.js" data-handle="your-handle" data-amount="5" data-theme="auto"></script>
```

```tsx
import { BuyACoffee } from "@perkos/buy-a-coffee/react";

<BuyACoffee handle="your-handle" amount={5} label="Buy me an x402 coffee" onResult={(r) => r.status === "paid" && toast("Thanks!")} />
```

```ts
import { createCoffeeLink, onCoffeeResult, consumeResult } from "@perkos/buy-a-coffee";
const url = createCoffeeLink({ handle: "your-handle", amount: 10, returnTo: "https://your.site/thanks" });
onCoffeeResult((r) => console.log(r)); // { status: "paid" | "cancelled" | "failed", tx, amount }
consumeResult(); // reads ?coffee=… from the current URL, cleans it, dispatches "perkos:coffee"
```

Options: `handle` (required), `amount`, `memo`, `returnTo` (defaults to the current page), `label`, `theme` (`light` | `dark` | `auto`), `baseUrl`.

import assert from "node:assert/strict";
import test from "node:test";

const APP = "https://buyacoffee.perkos.xyz";

test("return_to is honored only for listed origins and the app itself", async () => {
  const { isAllowedReturnTo } = await import("../lib/returnTo.ts");
  const allowed = ["https://juliomcruz.xyz", "www.juliomcruz.xyz"];
  assert.equal(isAllowedReturnTo("https://juliomcruz.xyz/?x=1", allowed, APP), true);
  assert.equal(isAllowedReturnTo("https://www.juliomcruz.xyz/page", allowed, APP), true);
  assert.equal(isAllowedReturnTo("https://buyacoffee.perkos.xyz/thanks", allowed, APP), true);
  assert.equal(isAllowedReturnTo("https://evil.example/juliomcruz.xyz", allowed, APP), false);
  assert.equal(isAllowedReturnTo("javascript:alert(1)", allowed, APP), false);
  assert.equal(isAllowedReturnTo("not a url", allowed, APP), false);
  assert.equal(isAllowedReturnTo(null, allowed, APP), false);
});

test("withResult replaces previous result params", async () => {
  const { withResult } = await import("../lib/returnTo.ts");
  const out = withResult("https://juliomcruz.xyz/?coffee=cancelled&keep=1", { status: "paid", tx: "0xabc", amount: "5" });
  const u = new URL(out);
  assert.equal(u.searchParams.get("coffee"), "paid");
  assert.equal(u.searchParams.get("tx"), "0xabc");
  assert.equal(u.searchParams.get("amount"), "5");
  assert.equal(u.searchParams.get("keep"), "1");
});

test("coffeeNonce and memoHash are deterministic", async () => {
  const { coffeeNonce, memoHash, usdcUnits } = await import("../lib/pure.ts");
  const a = coffeeNonce("0x00000000000000000000000000000000c0ffee00", "0x" + "11".repeat(32));
  const b = coffeeNonce("0x00000000000000000000000000000000C0FFEE00", "0x" + "11".repeat(32));
  assert.equal(a, b);
  assert.equal(memoHash(""), "0x" + "0".repeat(64));
  assert.notEqual(memoHash("thanks"), memoHash("thanks!"));
  assert.equal(usdcUnits(5), "5000000");
  assert.equal(usdcUnits(12.5), "12500000");
});

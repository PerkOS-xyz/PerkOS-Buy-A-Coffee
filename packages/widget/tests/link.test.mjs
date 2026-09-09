import assert from "node:assert/strict";
import test from "node:test";

test("createCoffeeLink builds the checkout URL with return_to, amount and memo", async () => {
  const { createCoffeeLink } = await import("../src/index.ts");
  const url = new URL(createCoffeeLink({ handle: "JulioMCruz", amount: 5, memo: "great post", returnTo: "https://juliomcruz.xyz/?coffee=paid&tx=0xabc" }));
  assert.equal(url.origin + url.pathname, "https://buyacoffee.perkos.xyz/juliomcruz");
  assert.equal(url.searchParams.get("amount"), "5");
  assert.equal(url.searchParams.get("memo"), "great post");
  // A previous result is stripped from return_to.
  assert.equal(url.searchParams.get("return_to"), "https://juliomcruz.xyz/");
});

test("createCoffeeLink rejects bad handles and honors baseUrl", async () => {
  const { createCoffeeLink } = await import("../src/index.ts");
  assert.throws(() => createCoffeeLink({ handle: "../etc", returnTo: "https://x.y" }));
  const u = createCoffeeLink({ handle: "a", returnTo: "https://x.y/p", baseUrl: "https://staging.example/" });
  assert.ok(u.startsWith("https://staging.example/a?"));
});

test("parseResult reads and validates the result params", async () => {
  const { parseResult } = await import("../src/index.ts");
  assert.deepEqual(parseResult("https://s.ite/?coffee=paid&tx=0x" + "a".repeat(64) + "&amount=5"), { status: "paid", tx: "0x" + "a".repeat(64), amount: 5 });
  assert.deepEqual(parseResult("https://s.ite/?coffee=cancelled"), { status: "cancelled", tx: null, amount: null });
  assert.equal(parseResult("https://s.ite/?coffee=nope"), null);
  assert.deepEqual(parseResult("https://s.ite/?coffee=paid&tx=javascript:1"), { status: "paid", tx: null, amount: null });
});

test("wallet mode links to /pay with the receiving wallet", async () => {
  const { createCoffeeLink } = await import("../src/index.ts");
  const url = new URL(createCoffeeLink({ wallet: "0xC2564e41B7F5Cb66d2d99466450CfebcE9e8228F", name: "Julio", amount: 5, returnTo: "https://juliomcruz.xyz/" }));
  assert.equal(url.pathname, "/pay");
  assert.equal(url.searchParams.get("to"), "0xc2564e41b7f5cb66d2d99466450cfebce9e8228f");
  assert.equal(url.searchParams.get("name"), "Julio");
  assert.equal(url.searchParams.get("amount"), "5");
  assert.throws(() => createCoffeeLink({ wallet: "0x123", returnTo: "https://x.y" }));
});

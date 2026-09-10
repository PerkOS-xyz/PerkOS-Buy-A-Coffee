import assert from "node:assert/strict";
import test from "node:test";

async function fresh(env) {
  for (const k of Object.keys(process.env)) if (/^(NETWORK|NETWORKS|COFFEE_SPLIT_|RPC_URL|LOG_CHUNK_)/.test(k)) delete process.env[k];
  Object.assign(process.env, env);
  return import(`../lib/config.ts?${Math.random()}`);
}

test("only networks with a CoffeeSplit address are enabled; the default comes first", async () => {
  const c = await fresh({ NETWORK: "base", NETWORKS: "celo,robinhood,base-sepolia" });
  assert.deepEqual(c.enabledNetworkKeys(), ["base", "base-sepolia"], "celo/robinhood have no address yet");
  const c2 = await fresh({ NETWORK: "base", NETWORKS: "celo,robinhood", COFFEE_SPLIT_ADDRESS_CELO: "0x" + "11".repeat(20), COFFEE_SPLIT_ADDRESS_ROBINHOOD: "0x" + "22".repeat(20) });
  assert.deepEqual(c2.enabledNetworkKeys(), ["base", "celo", "robinhood"]);
  const celo = c2.getNetwork("celo");
  assert.equal(celo.symbol, "USDC");
  assert.equal(celo.chainId, 42220);
  assert.equal(celo.coffeeSplit, "0x" + "11".repeat(20));
  const rh = c2.getNetwork("robinhood");
  assert.equal(rh.symbol, "USDG");
  assert.deepEqual(rh.domain, { name: "Global Dollar", version: "1" });
  assert.equal(rh.native.symbol, "ETH");
  assert.throws(() => c2.getNetwork("base-sepolia"), /not enabled/);
  assert.equal(c2.tryNetwork("nope"), null);
});

test("legacy single-network envs still apply to the default network", async () => {
  const c = await fresh({ NETWORK: "base", COFFEE_SPLIT_ADDRESS: "0x" + "33".repeat(20), COFFEE_SPLIT_FROM_BLOCK: "123", RPC_URL: "https://rpc.example" });
  const n = c.getNetwork();
  assert.equal(n.coffeeSplit, "0x" + "33".repeat(20));
  assert.equal(n.fromBlock, 123n);
  assert.equal(n.rpcUrl, "https://rpc.example");
  assert.equal(c.networkByCaip2("eip155:8453")?.key, "base");
  assert.equal(c.explorerTx("robinhood", "0xabc"), "https://robinhoodchain.blockscout.com/tx/0xabc");
});

test("publicConfig carries the symbol, native currency and the switchable list", async () => {
  const c = await fresh({ NETWORK: "base", NETWORKS: "base-sepolia" });
  const p = c.publicConfig("base-sepolia");
  assert.equal(p.network, "base-sepolia");
  assert.equal(p.symbol, "USDC");
  assert.equal(p.native.symbol, "ETH");
  assert.deepEqual(p.networks.map((n) => n.key), ["base", "base-sepolia"]);
  assert.equal(p.explorer, "https://sepolia.basescan.org");
});

test("each network carries the getLogs window its public RPC accepts; env overrides it", async () => {
  const c = await fresh({ NETWORK: "base", NETWORKS: "base-sepolia,celo,robinhood", COFFEE_SPLIT_ADDRESS_CELO: "0x" + "11".repeat(20), COFFEE_SPLIT_ADDRESS_ROBINHOOD: "0x" + "22".repeat(20) });
  assert.equal(c.getNetwork("base").logChunk, 2000n, "Base public RPC refuses more than 2,000 blocks");
  assert.equal(c.getNetwork("celo").logChunk, 4999n);
  assert.ok(c.getNetwork("base-sepolia").logChunk <= 10_000n);
  assert.ok(c.getNetwork("robinhood").logChunk >= 9000n);
  const c2 = await fresh({ NETWORK: "base", NETWORKS: "base-sepolia", LOG_CHUNK_BASE: "10000", LOG_CHUNK_BASE_SEPOLIA: "nope" });
  assert.equal(c2.getNetwork("base").logChunk, 10_000n);
  assert.equal(c2.getNetwork("base-sepolia").logChunk, 9000n, "an invalid override falls back to the known cap");
});

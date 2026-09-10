import assert from "node:assert/strict";
import test from "node:test";
import { collectLogs, isRangeError } from "../lib/logWindows.ts";

/** An RPC that refuses windows wider than `cap` blocks and returns one log per block that is a multiple of 1000. */
function fakeRpc(cap, message = "eth_getLogs is limited to a 2,000 range") {
  const calls = [];
  return {
    calls,
    getLogs: async (from, to) => {
      calls.push([from, to]);
      if (to - from + 1n > cap) throw new Error(message);
      const out = [];
      for (let b = from; b <= to; b++) if (b % 1000n === 0n) out.push({ block: b });
      return out;
    },
  };
}

test("range errors are recognised in the wording of the public RPCs", () => {
  assert.ok(isRangeError("eth_getLogs is limited to a 2,000 range"));
  assert.ok(isRangeError("eth_getLogs is limited to a 10,000 range"));
  assert.ok(isRangeError("query exceeds range, retry smaller (max block range 5000, got 9000)"));
  assert.ok(isRangeError("Block range too large"));
  assert.ok(isRangeError("query returned more than 10000 results"));
  assert.ok(!isRangeError("block is out of range"), "toBlock beyond head is not a window-size problem");
  assert.ok(!isRangeError("HTTP request failed"));
  assert.ok(!isRangeError("invalid address"));
});

test("halves the window until the RPC accepts it and still returns every log", async () => {
  const rpc = fakeRpc(2000n);
  const { logs, chunk, calls } = await collectLogs(rpc.getLogs, 51_103_530n, 51_137_493n, 9000n);
  assert.deepEqual(logs.map((l) => l.block), Array.from({ length: 34 }, (_, i) => 51_104_000n + BigInt(i) * 1000n));
  assert.equal(chunk, 1125n, "9000 -> 4500 -> 2250 -> 1125");
  assert.equal(calls, rpc.calls.length);
  const widths = rpc.calls.map(([a, b]) => b - a + 1n);
  assert.ok(widths.slice(-3).every((w) => w <= 2000n));
  // Windows are contiguous and cover the range exactly once at the accepted size.
  const accepted = rpc.calls.filter(([a, b]) => b - a + 1n <= 2000n).sort((x, y) => Number(x[0] - y[0]));
  assert.equal(accepted[0][0], 51_103_530n);
  assert.equal(accepted[accepted.length - 1][1], 51_137_493n);
  for (let i = 1; i < accepted.length; i++) assert.equal(accepted[i][0], accepted[i - 1][1] + 1n);
});

test("a known-good chunk is used as is, with several windows in flight", async () => {
  const rpc = fakeRpc(2000n);
  const { logs, chunk, calls } = await collectLogs(rpc.getLogs, 0n, 9999n, 2000n, 4);
  assert.equal(chunk, 2000n);
  assert.equal(calls, 5);
  assert.equal(logs.length, 10);
});

test("an empty or inverted range makes no calls", async () => {
  const rpc = fakeRpc(2000n);
  const r = await collectLogs(rpc.getLogs, 10n, 9n, 2000n);
  assert.deepEqual(r, { logs: [], chunk: 2000n, calls: 0 });
});

test("other RPC errors are not swallowed", async () => {
  const rpc = { getLogs: async () => { throw new Error("HTTP request failed"); } };
  await assert.rejects(collectLogs(rpc.getLogs, 0n, 100n, 50n), /HTTP request failed/);
});

test("stops shrinking at the floor and reports the RPC's refusal", async () => {
  const rpc = fakeRpc(10n);
  await assert.rejects(collectLogs(rpc.getLogs, 0n, 1000n, 400n, 2, 100n), /limited to a 2,000 range/);
});

// On-chain coffee history straight from CoffeeSplit's `Coffee` event.
// The chain is the source of truth; the database (when present) only adds
// memos and pending/failed attempts.
import { createPublicClient, http, parseAbiItem, type Address, type Hex } from "viem";
import { getNetwork } from "./config";

export const COFFEE_EVENT = parseAbiItem(
  "event Coffee(address indexed creator, address indexed from, uint256 value, uint256 fee, bytes32 indexed nonce, bytes32 memoHash)",
);

/** First block to scan per network (contract deployment). */
const FROM_BLOCK: Record<string, bigint> = {
  "base-sepolia": 46_581_089n,
  base: 0n,
};

export interface ChainCoffee {
  txHash: Hex;
  blockNumber: bigint;
  creator: Address;
  from: Address;
  value: bigint; // token units, 6 decimals
  fee: bigint;
  nonce: Hex;
  memoHash: Hex;
  timestamp: number | null;
}

const CHUNK = 9_000n; // public RPCs cap getLogs ranges; stay under 10k blocks
const cache = new Map<string, { at: number; data: ChainCoffee[] }>();

async function scan(filter: { creator?: Address; from?: Address }, ttlMs = 30_000): Promise<ChainCoffee[]> {
  const n = getNetwork();
  const key = `${n.key}:${filter.creator ?? ""}:${filter.from ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;

  const client = createPublicClient({ transport: http(n.rpcUrl) });
  const latest = await client.getBlockNumber();
  const start = BigInt(process.env.COFFEE_SPLIT_FROM_BLOCK || FROM_BLOCK[n.key] || 0n);
  const out: ChainCoffee[] = [];
  for (let from = start; from <= latest; from += CHUNK + 1n) {
    const to = from + CHUNK > latest ? latest : from + CHUNK;
    const logs = await client.getLogs({
      address: n.coffeeSplit,
      event: COFFEE_EVENT,
      args: { creator: filter.creator, from: filter.from },
      fromBlock: from,
      toBlock: to,
    });
    for (const l of logs) {
      out.push({
        txHash: l.transactionHash as Hex,
        blockNumber: l.blockNumber,
        creator: l.args.creator as Address,
        from: l.args.from as Address,
        value: l.args.value as bigint,
        fee: l.args.fee as bigint,
        nonce: l.args.nonce as Hex,
        memoHash: l.args.memoHash as Hex,
        timestamp: null,
      });
    }
  }
  // Timestamps for the most recent 50 (one block read each).
  const recent = out.sort((a, b) => Number(b.blockNumber - a.blockNumber)).slice(0, 50);
  const blocks = new Map<bigint, number>();
  await Promise.all(
    [...new Set(recent.map((c) => c.blockNumber))].map(async (bn) => {
      try {
        const b = await client.getBlock({ blockNumber: bn });
        blocks.set(bn, Number(b.timestamp));
      } catch {
        // leave null
      }
    }),
  );
  for (const c of recent) c.timestamp = blocks.get(c.blockNumber) ?? null;
  cache.set(key, { at: Date.now(), data: out });
  return out;
}

export function coffeesReceived(wallet: Address) {
  return scan({ creator: wallet });
}
export function coffeesSent(wallet: Address) {
  return scan({ from: wallet });
}
export function coffeesCountFor(wallet: Address) {
  return scan({ creator: wallet }, 60_000).then((l) => l.length);
}

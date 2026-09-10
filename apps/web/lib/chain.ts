// On-chain coffee history straight from CoffeeSplit's `Coffee` event, on every
// enabled network. The chain is the source of truth; the database (when
// present) only adds memos and pending/failed attempts.
//
// Each network is scanned once, unfiltered, and kept in memory: later reads
// filter by creator or donor without touching the RPC, and a scan after the
// TTL only fetches the blocks mined since the last one (re-reading a few for
// reorgs). A cold instance still walks from the deployment block, in windows
// the network's public RPC accepts (lib/logWindows.ts); when an RPC refuses a
// window the scanner halves it, and when an RPC is down the failure is logged,
// reported by /api/health and the last good history is served instead of an
// empty one.
import { createPublicClient, http, parseAbiItem, type Address, type Hex, type PublicClient } from "viem";
import { enabledNetworks, type NetworkConfig, type NetworkKey } from "./config";
import { collectLogs } from "./logWindows";

export const COFFEE_EVENT = parseAbiItem(
  "event Coffee(address indexed creator, address indexed from, uint256 value, uint256 fee, bytes32 indexed nonce, bytes32 memoHash)",
);

export interface ChainCoffee {
  network: NetworkKey;
  symbol: string;
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

export interface ScanStatus {
  network: NetworkKey;
  ok: boolean;
  /** Coffees known on this network (all creators). */
  coffees: number;
  /** Last block the history is complete up to. */
  scannedTo: bigint | null;
  /** Window size the RPC accepted last. */
  chunk: bigint;
  calls: number;
  ms: number;
  at: number;
  error?: string;
  /** True when the last scan failed and the numbers above come from the previous good one. */
  stale?: boolean;
}

interface NetCache {
  scannedTo: bigint;
  at: number;
  rows: ChainCoffee[]; // newest first
  chunk: bigint;
  times: Map<bigint, number>; // block -> unix seconds
}

/** Blocks re-read on every incremental scan so a shallow reorg cannot leave a phantom coffee behind. */
const REORG_DEPTH = 30n;
const TIMESTAMPS_FOR = 50;

const cache = new Map<NetworkKey, NetCache>();
const status = new Map<NetworkKey, ScanStatus>();
const inflight = new Map<NetworkKey, Promise<ChainCoffee[]>>();

const rowKey = (r: ChainCoffee) => `${r.txHash}:${r.nonce}`;

function toRow(n: NetworkConfig, l: { transactionHash: Hex | null; blockNumber: bigint | null; args: Record<string, unknown> }): ChainCoffee {
  return {
    network: n.key,
    symbol: n.symbol,
    txHash: l.transactionHash as Hex,
    blockNumber: l.blockNumber as bigint,
    creator: l.args.creator as Address,
    from: l.args.from as Address,
    value: l.args.value as bigint,
    fee: l.args.fee as bigint,
    nonce: l.args.nonce as Hex,
    memoHash: l.args.memoHash as Hex,
    timestamp: null,
  };
}

async function fillTimestamps(client: PublicClient, rows: ChainCoffee[], times: Map<bigint, number>) {
  const missing = [...new Set(rows.map((c) => c.blockNumber))].filter((bn) => !times.has(bn));
  await Promise.all(
    missing.map(async (bn) => {
      try {
        const b = await client.getBlock({ blockNumber: bn });
        times.set(bn, Number(b.timestamp));
      } catch {
        // leave null
      }
    }),
  );
  for (const c of rows) c.timestamp = times.get(c.blockNumber) ?? c.timestamp ?? null;
}

async function scanNetwork(n: NetworkConfig, client: PublicClient, ttlMs: number): Promise<ChainCoffee[]> {
  const hit = cache.get(n.key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.rows;
  const t0 = Date.now();
  try {
    const latest = await client.getBlockNumber();
    const resume = hit ? hit.scannedTo - REORG_DEPTH : n.fromBlock;
    const start = resume > n.fromBlock ? resume : n.fromBlock;
    const chunk0 = hit?.chunk ?? n.logChunk;
    const { logs, chunk, calls } =
      latest >= start
        ? await collectLogs((fromBlock, toBlock) => client.getLogs({ address: n.coffeeSplit, event: COFFEE_EVENT, fromBlock, toBlock }), start, latest, chunk0)
        : { logs: [], chunk: chunk0, calls: 0 };
    const rows = new Map<string, ChainCoffee>();
    for (const r of hit?.rows ?? []) if (r.blockNumber < start) rows.set(rowKey(r), r);
    for (const l of logs) {
      const r = toRow(n, l);
      rows.set(rowKey(r), r);
    }
    const all = [...rows.values()].sort((a, b) => Number(b.blockNumber - a.blockNumber));
    const times = hit?.times ?? new Map<bigint, number>();
    await fillTimestamps(client, all.slice(0, TIMESTAMPS_FOR), times);
    cache.set(n.key, { scannedTo: latest, at: Date.now(), rows: all, chunk, times });
    status.set(n.key, { network: n.key, ok: true, coffees: all.length, scannedTo: latest, chunk, calls, ms: Date.now() - t0, at: Date.now() });
    return all;
  } catch (e) {
    const error = ((e as Error).message ?? String(e)).split("\n")[0].slice(0, 300);
    console.error(`[chain] scan failed on ${n.key} (${n.rpcUrl}): ${error}`);
    status.set(n.key, {
      network: n.key,
      ok: false,
      coffees: hit?.rows.length ?? 0,
      scannedTo: hit?.scannedTo ?? null,
      chunk: hit?.chunk ?? n.logChunk,
      calls: 0,
      ms: Date.now() - t0,
      at: Date.now(),
      error,
      stale: Boolean(hit),
    });
    if (hit) return hit.rows; // last good history beats an empty dashboard
    throw e;
  }
}

/** One scan per network at a time; concurrent readers share it. */
function scanShared(n: NetworkConfig, client: PublicClient, ttlMs: number): Promise<ChainCoffee[]> {
  const running = inflight.get(n.key);
  if (running) return running;
  const p = scanNetwork(n, client, ttlMs).finally(() => inflight.delete(n.key));
  inflight.set(n.key, p);
  return p;
}

const same = (a: Address, b?: Address) => !b || a.toLowerCase() === b.toLowerCase();

/** Scan every enabled network; one failing RPC does not hide the others. */
async function scan(filter: { creator?: Address; from?: Address }, ttlMs = 30_000): Promise<ChainCoffee[]> {
  const results = await Promise.allSettled(
    enabledNetworks().map(async (n) => {
      const client = createPublicClient({ transport: http(n.rpcUrl) });
      const rows = (await scanShared(n, client, ttlMs)).filter((r) => same(r.creator, filter.creator) && same(r.from, filter.from));
      // Timestamps for the most recent of this reader's rows (the network scan only covers its own newest).
      const times = cache.get(n.key)?.times ?? new Map<bigint, number>();
      await fillTimestamps(client, rows.slice(0, TIMESTAMPS_FOR), times);
      return rows;
    }),
  );
  const out: ChainCoffee[] = [];
  for (const r of results) if (r.status === "fulfilled") out.push(...r.value);
  return out.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0) || Number(b.blockNumber - a.blockNumber));
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

/**
 * Health view of the index on one network: runs (or reuses, within a minute)
 * the scan and reports whether it succeeded. A network whose scan fails shows
 * no coffees on dashboards and badges, which is worth an alert.
 */
export async function scanHealth(n: NetworkConfig): Promise<ScanStatus> {
  const client = createPublicClient({ transport: http(n.rpcUrl) });
  await scanShared(n, client, 60_000).catch(() => []);
  return (
    status.get(n.key) ?? { network: n.key, ok: false, coffees: 0, scannedTo: null, chunk: n.logChunk, calls: 0, ms: 0, at: Date.now(), error: "not scanned" }
  );
}

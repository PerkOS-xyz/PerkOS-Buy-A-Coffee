/**
 * Fetching event logs from public RPCs, which cap the block range of one
 * eth_getLogs call and say so in different words. Pure: no network, no env,
 * so it is unit-tested without a chain.
 *
 * Measured caps of the public endpoints this service defaults to (2026-09-10):
 *   Base            2,000 blocks  ("eth_getLogs is limited to a 2,000 range")
 *   Base Sepolia   10,000 blocks
 *   Celo (forno)    5,000 blocks  ("query exceeds range, retry smaller (max block range 5000, ...)")
 *   Robinhood       none observed up to 100,000
 * They change without notice, so the caller starts from a known-good chunk
 * and `collectLogs` halves it whenever the RPC refuses the range.
 */

export type GetLogs<L> = (fromBlock: bigint, toBlock: bigint) => Promise<L[]>;

/** True when an RPC error is about the size of the requested window (blocks or results), not about the query itself. */
export function isRangeError(message: string): boolean {
  return /limited to a [\d,]+ range|block range|range too (large|big)|exceeds range|exceed(s|ed)? (the )?max(imum)? (block )?range|too many blocks|query returned more than|response size|result set too large|max results/i.test(message);
}

export interface Collected<L> {
  logs: L[];
  /** The window size that worked last; remember it so the next scan does not re-learn the cap. */
  chunk: bigint;
  calls: number;
}

/**
 * Fetch every log in [from, to] using windows of `chunk` blocks, `concurrency`
 * windows in flight. On a range error the window is halved (down to `minChunk`)
 * and the failing stretch is retried; any other error is rethrown, so a dead
 * RPC is reported instead of quietly returning a partial history.
 */
export async function collectLogs<L>(getLogs: GetLogs<L>, from: bigint, to: bigint, chunk: bigint, concurrency = 4, minChunk = 100n): Promise<Collected<L>> {
  const logs: L[] = [];
  let calls = 0;
  let cursor = from;
  let size = chunk < 1n ? 1n : chunk;
  while (cursor <= to) {
    const windows: [bigint, bigint][] = [];
    for (let w = cursor; w <= to && windows.length < concurrency; ) {
      const end = w + size - 1n > to ? to : w + size - 1n;
      windows.push([w, end]);
      w = end + 1n;
    }
    const results = await Promise.allSettled(windows.map(([a, b]) => getLogs(a, b)));
    calls += windows.length;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        logs.push(...r.value);
        cursor = windows[i][1] + 1n; // contiguous: everything before this window is in
        continue;
      }
      const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
      if (isRangeError(message) && size > minChunk) {
        size = size / 2n < minChunk ? minChunk : size / 2n;
        break; // retry from the failing window with the smaller size; later windows in this batch are refetched
      }
      throw r.reason;
    }
  }
  return { logs, chunk: size, calls };
}

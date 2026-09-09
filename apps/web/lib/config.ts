// Networks the service can settle coffees on. One deployment serves several:
// the donor (or the widget) picks one, and every request carries it. Each
// network needs a CoffeeSplit deployment (address) and a sponsor wallet with
// gas on Stack's side; a network without a split address is not enabled.
import type { Address } from "viem";

export type NetworkKey = "base" | "base-sepolia" | "celo" | "robinhood";

export interface NetworkConfig {
  key: NetworkKey;
  caip2: string;
  chainId: number;
  name: string;
  /** The stablecoin CoffeeSplit pulls (6 decimals on every supported network). */
  asset: Address;
  symbol: string;
  /** EIP-712 domain of the token when it cannot be read on-chain (USDG has no version()). */
  domain?: { name: string; version: string };
  /** Explorer base, tx pages at `${explorer}/tx/${hash}`. */
  explorer: string;
  native: { name: string; symbol: string };
  rpcUrl: string;
  coffeeSplit: Address;
  /** First block to scan for Coffee events (the split deployment block). */
  fromBlock: bigint;
}

type Known = Omit<NetworkConfig, "rpcUrl" | "coffeeSplit" | "fromBlock"> & { defaultRpc: string };

const KNOWN: Record<NetworkKey, Known> = {
  base: {
    key: "base", caip2: "eip155:8453", chainId: 8453, name: "Base",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC",
    explorer: "https://basescan.org", native: { name: "Ether", symbol: "ETH" }, defaultRpc: "https://mainnet.base.org",
  },
  "base-sepolia": {
    key: "base-sepolia", caip2: "eip155:84532", chainId: 84532, name: "Base Sepolia",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", symbol: "USDC",
    explorer: "https://sepolia.basescan.org", native: { name: "Ether", symbol: "ETH" }, defaultRpc: "https://sepolia.base.org",
  },
  celo: {
    key: "celo", caip2: "eip155:42220", chainId: 42220, name: "Celo",
    asset: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", symbol: "USDC",
    domain: { name: "USDC", version: "2" },
    explorer: "https://celoscan.io", native: { name: "CELO", symbol: "CELO" }, defaultRpc: "https://forno.celo.org",
  },
  robinhood: {
    key: "robinhood", caip2: "eip155:4663", chainId: 4663, name: "Robinhood Chain",
    asset: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", symbol: "USDG",
    // USDG (Global Dollar) exposes neither version() nor eip712Domain(); the on-chain DOMAIN_SEPARATOR matches name "Global Dollar", version "1".
    domain: { name: "Global Dollar", version: "1" },
    explorer: "https://robinhoodchain.blockscout.com", native: { name: "Ether", symbol: "ETH" }, defaultRpc: "https://rpc.mainnet.chain.robinhood.com",
  },
};

/** Known CoffeeSplit deployments (verified). Env `COFFEE_SPLIT_ADDRESS_<KEY>` overrides or adds. */
const KNOWN_SPLIT: Partial<Record<NetworkKey, Address>> = {
  base: "0xf8aaa69ef77d91dd4419d883252d3d0f0fd09d90",
  "base-sepolia": "0x704F85Bca00617096fa4F3d5C5499Ff373Fd5d38",
};
const KNOWN_FROM_BLOCK: Partial<Record<NetworkKey, bigint>> = {
  base: 51_103_530n,
  "base-sepolia": 46_581_089n,
};

export const DEFAULT_NETWORK = (process.env.NETWORK || "base") as NetworkKey;

const envKey = (key: NetworkKey) => key.toUpperCase().replace(/-/g, "_");

function splitAddress(key: NetworkKey): Address | null {
  const specific = process.env[`COFFEE_SPLIT_ADDRESS_${envKey(key)}`];
  if (specific) return specific as Address;
  // Legacy single-network env applies to the default network only.
  if (key === DEFAULT_NETWORK && process.env.COFFEE_SPLIT_ADDRESS) return process.env.COFFEE_SPLIT_ADDRESS as Address;
  return KNOWN_SPLIT[key] ?? null;
}

function fromBlock(key: NetworkKey): bigint {
  const specific = process.env[`COFFEE_SPLIT_FROM_BLOCK_${envKey(key)}`];
  if (specific) return BigInt(specific);
  if (key === DEFAULT_NETWORK && process.env.COFFEE_SPLIT_FROM_BLOCK) return BigInt(process.env.COFFEE_SPLIT_FROM_BLOCK);
  return KNOWN_FROM_BLOCK[key] ?? 0n;
}

function rpcUrl(key: NetworkKey): string {
  const specific = process.env[`RPC_URL_${envKey(key)}`];
  if (specific) return specific;
  if (key === DEFAULT_NETWORK && process.env.RPC_URL) return process.env.RPC_URL;
  return KNOWN[key].defaultRpc;
}

export function isNetworkKey(v: unknown): v is NetworkKey {
  return typeof v === "string" && v in KNOWN;
}

/**
 * Networks this deployment serves: env `NETWORKS` (csv) or the default network,
 * keeping only those with a CoffeeSplit address. The default network comes first.
 */
export function enabledNetworkKeys(): NetworkKey[] {
  const raw = (process.env.NETWORKS || DEFAULT_NETWORK).split(",").map((s) => s.trim()).filter(Boolean);
  const keys = [DEFAULT_NETWORK, ...raw].filter((k, i, a) => isNetworkKey(k) && a.indexOf(k) === i) as NetworkKey[];
  return keys.filter((k) => splitAddress(k) !== null);
}

function build(key: NetworkKey): NetworkConfig {
  const known = KNOWN[key];
  const coffeeSplit = splitAddress(key);
  if (!coffeeSplit) throw new Error(`Network ${key} has no CoffeeSplit address`);
  const { defaultRpc: _drop, ...rest } = known;
  void _drop;
  return { ...rest, rpcUrl: rpcUrl(key), coffeeSplit, fromBlock: fromBlock(key) };
}

/** The network for a request; throws when it is unknown or not enabled. */
export function getNetwork(key?: string | null): NetworkConfig {
  const k = (key || DEFAULT_NETWORK) as NetworkKey;
  if (!enabledNetworkKeys().includes(k)) throw new Error(`Network ${k} is not enabled`);
  return build(k);
}

export function tryNetwork(key?: string | null): NetworkConfig | null {
  try {
    return getNetwork(key);
  } catch {
    return null;
  }
}

export function enabledNetworks(): NetworkConfig[] {
  return enabledNetworkKeys().map(build);
}

export function networkByCaip2(caip2: string): NetworkConfig | null {
  const key = (Object.keys(KNOWN) as NetworkKey[]).find((k) => KNOWN[k].caip2 === caip2);
  return key ? tryNetwork(key) : null;
}

export function explorerTx(key: string, tx: string): string {
  const known = isNetworkKey(key) ? KNOWN[key] : KNOWN.base;
  return `${known.explorer}/tx/${tx}`;
}

export const APP_URL = (process.env.APP_URL || "https://buyacoffee.perkos.xyz").replace(/\/$/, "");
export const STACK_URL = (process.env.PERKOS_STACK_URL || "https://stack.perkos.xyz").replace(/\/$/, "");
export const STACK_API_KEY = process.env.PERKOS_STACK_API_KEY || "";

export const MIN_USDC = 1;
export const MAX_USDC = 1000;
export const FEE_BPS = 200;

/** What the browser needs, for one network plus the list to switch to. */
export function publicConfig(key?: string | null) {
  const n = getNetwork(key);
  return {
    network: n.key,
    caip2: n.caip2,
    chainId: n.chainId,
    networkName: n.name,
    rpcUrl: n.rpcUrl,
    /** Kept under the historical name; it is the stablecoin of the network (USDC or USDG). */
    usdc: n.asset,
    symbol: n.symbol,
    native: n.native,
    explorer: n.explorer,
    coffeeSplit: n.coffeeSplit,
    appUrl: APP_URL,
    minUsdc: MIN_USDC,
    maxUsdc: MAX_USDC,
    feeBps: FEE_BPS,
    networks: enabledNetworks().map((x) => ({ key: x.key, name: x.name, symbol: x.symbol })),
  };
}
export type PublicConfig = ReturnType<typeof publicConfig>;

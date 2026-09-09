// Runtime configuration. One network per deployment (v1: Base Sepolia, then Base).
import type { Address } from "viem";

export type NetworkKey = "base-sepolia" | "base";

export interface NetworkConfig {
  key: NetworkKey;
  caip2: string;
  chainId: number;
  name: string;
  rpcUrl: string;
  usdc: Address;
  coffeeSplit: Address;
  explorerTx: (hash: string) => string;
}

const KNOWN: Record<NetworkKey, Omit<NetworkConfig, "coffeeSplit" | "rpcUrl">> = {
  "base-sepolia": {
    key: "base-sepolia",
    caip2: "eip155:84532",
    chainId: 84532,
    name: "Base Sepolia",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    explorerTx: (h) => `https://sepolia.basescan.org/tx/${h}`,
  },
  base: {
    key: "base",
    caip2: "eip155:8453",
    chainId: 8453,
    name: "Base",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorerTx: (h) => `https://basescan.org/tx/${h}`,
  },
};

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function getNetwork(): NetworkConfig {
  const key = (process.env.NETWORK || "base-sepolia") as NetworkKey;
  const base = KNOWN[key];
  if (!base) throw new Error(`Unsupported NETWORK ${key}`);
  // Base Sepolia has a known deployment; mainnet must be configured explicitly.
  const coffeeSplit = (process.env.COFFEE_SPLIT_ADDRESS ||
    (key === "base-sepolia" ? "0x704F85Bca00617096fa4F3d5C5499Ff373Fd5d38" : need("COFFEE_SPLIT_ADDRESS"))) as Address;
  const rpcUrl =
    process.env.RPC_URL || (key === "base" ? "https://mainnet.base.org" : "https://sepolia.base.org");
  return { ...base, coffeeSplit, rpcUrl };
}

export const APP_URL = (process.env.APP_URL || "https://buyacoffee.perkos.xyz").replace(/\/$/, "");
export const STACK_URL = (process.env.PERKOS_STACK_URL || "https://stack.perkos.xyz").replace(/\/$/, "");
export const STACK_API_KEY = process.env.PERKOS_STACK_API_KEY || "";

export const MIN_USDC = 1;
export const MAX_USDC = 1000;
export const FEE_BPS = 200;

/** Public, non-secret config for the browser. */
export function publicConfig() {
  const n = getNetwork();
  return {
    network: n.key,
    caip2: n.caip2,
    chainId: n.chainId,
    networkName: n.name,
    rpcUrl: n.rpcUrl,
    usdc: n.usdc,
    coffeeSplit: n.coffeeSplit,
    appUrl: APP_URL,
    minUsdc: MIN_USDC,
    maxUsdc: MAX_USDC,
    feeBps: FEE_BPS,
  };
}
export type PublicConfig = ReturnType<typeof publicConfig>;

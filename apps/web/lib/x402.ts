// x402 plumbing: EIP-3009 typed data for the donor, and verify/settle calls
// to the PerkOS facilitator (Stack) with the CoffeeSplit `extra.split`.
import { createPublicClient, http, type Address, type Hex } from "viem";
import { APP_URL, STACK_API_KEY, STACK_URL, getNetwork } from "./config";
import { memoHash } from "./pure";

export { coffeeNonce, memoHash, usdcUnits } from "./pure";

export interface Authorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}

const EIP712_ABI = [
  {
    name: "eip712Domain",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1" },
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "extensions", type: "uint256[]" },
    ],
  },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "version", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

let domainCache: { name: string; version: string } | null = null;

/** USDC's EIP-712 domain (name differs between Base "USD Coin" and Base Sepolia "USDC"). */
export async function usdcDomain(): Promise<{ name: string; version: string; chainId: number; verifyingContract: Address }> {
  const n = getNetwork();
  if (!domainCache) {
    const client = createPublicClient({ transport: http(n.rpcUrl) });
    try {
      const d = await client.readContract({ address: n.usdc, abi: EIP712_ABI, functionName: "eip712Domain" });
      domainCache = { name: d[1], version: d[2] };
    } catch {
      const name = await client.readContract({ address: n.usdc, abi: EIP712_ABI, functionName: "name" });
      let version = "2";
      try {
        version = await client.readContract({ address: n.usdc, abi: EIP712_ABI, functionName: "version" });
      } catch {
        // FiatTokenV2 without version(): "2"
      }
      domainCache = { name, version };
    }
  }
  return { ...domainCache, chainId: n.chainId, verifyingContract: n.usdc };
}

export const RECEIVE_TYPES = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export async function buildTypedData(auth: Authorization) {
  const domain = await usdcDomain();
  return {
    domain,
    types: RECEIVE_TYPES,
    primaryType: "ReceiveWithAuthorization" as const,
    message: {
      from: auth.from,
      to: auth.to,
      value: auth.value,
      validAfter: auth.validAfter,
      validBefore: auth.validBefore,
      nonce: auth.nonce,
    },
  };
}

export interface StackResult {
  ok: boolean;
  reason?: string;
  transaction?: string | null;
  payer?: string | null;
}

function requirements(params: { handle: string; amountUnits: string; creator: Address; coffeeId: Hex; memo: string | null }) {
  const n = getNetwork();
  return {
    scheme: "exact",
    network: n.caip2,
    amount: params.amountUnits,
    asset: n.usdc,
    payTo: n.coffeeSplit,
    maxTimeoutSeconds: 600,
    resource: {
      url: `${APP_URL}/${params.handle}`,
      description: `Buy ${params.handle} a coffee`,
      mimeType: "text/html",
    },
    extra: {
      split: {
        contract: n.coffeeSplit,
        creator: params.creator,
        coffeeId: params.coffeeId,
        memoHash: memoHash(params.memo),
      },
    },
  };
}

async function callStack(path: "verify" | "settle", body: unknown): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (STACK_API_KEY) headers["X-API-Key"] = STACK_API_KEY;
  const r = await fetch(`${STACK_URL}/api/v2/x402/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(path === "settle" ? 120_000 : 30_000),
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok && !("isValid" in json) && !("success" in json)) {
    throw new Error(`stack ${path} ${r.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

/** verify then settle a coffee through Stack. */
export async function settleCoffee(params: {
  handle: string;
  amountUnits: string;
  creator: Address;
  coffeeId: Hex;
  memo: string | null;
  authorization: Authorization;
  signature: Hex;
}): Promise<StackResult> {
  const n = getNetwork();
  const body = {
    x402Version: 2,
    paymentPayload: {
      x402Version: 2,
      scheme: "exact",
      network: n.caip2,
      payload: { signature: params.signature, authorization: params.authorization },
    },
    paymentRequirements: requirements(params),
  };
  const v = await callStack("verify", body);
  if (v.isValid !== true) {
    return { ok: false, reason: String(v.invalidReason || "Payment rejected"), payer: (v.payer as string) ?? null };
  }
  const s = await callStack("settle", body);
  if (s.success !== true) {
    return { ok: false, reason: String(s.errorReason || s.error || "Settlement failed"), payer: (s.payer as string) ?? null };
  }
  return { ok: true, transaction: (s.transaction as string) ?? null, payer: (s.payer as string) ?? null };
}

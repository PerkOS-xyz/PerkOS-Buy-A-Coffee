// Pure helpers (no env, no network) shared by the API routes and the tests.
import { encodePacked, keccak256, parseUnits, type Address, type Hex } from "viem";

/** Mirrors CoffeeSplit.coffeeNonce and Stack's coffeeNonce. */
export function coffeeNonce(creator: Address, coffeeId: Hex): Hex {
  return keccak256(
    encodePacked(["string", "address", "bytes32"], ["PerkOS.Coffee.v1", creator.toLowerCase() as Address, coffeeId]),
  );
}

export function memoHash(memo: string | null | undefined): Hex {
  if (!memo) return `0x${"0".repeat(64)}` as Hex;
  return keccak256(new TextEncoder().encode(memo));
}

export function usdcUnits(amount: number): string {
  return parseUnits(amount.toFixed(6), 6).toString();
}

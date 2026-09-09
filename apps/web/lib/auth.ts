// Wallet sessions. The browser connects a wallet with Privy, signs a short
// challenge, and the server sets a signed cookie whose subject is the wallet.
// No email, no Privy server secret: the signature is the proof.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHmac, randomBytes } from "node:crypto";
import { verifyMessage, type Address, type Hex } from "viem";

const COOKIE = "bac_session";
const TTL_SECONDS = 60 * 60 * 24 * 30;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

/** Stateless challenge: nonce + expiry + HMAC, embedded in the message the wallet signs. */
export function issueChallenge(address: Address): { message: string; token: string } {
  const nonce = randomBytes(16).toString("hex");
  const exp = Date.now() + CHALLENGE_TTL_MS;
  const payload = `${address.toLowerCase()}.${nonce}.${exp}`;
  const mac = createHmac("sha256", Buffer.from(secret())).update(payload).digest("hex");
  const token = `${payload}.${mac}`;
  const message = [
    "Sign in to Buy A Coffee (buyacoffee.perkos.xyz).",
    "",
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(exp).toISOString()}`,
    "",
    "This signature only proves you control this wallet. It does not move funds.",
  ].join("\n");
  return { message, token };
}

export function challengeMessageFromToken(token: string): { address: Address; message: string } | null {
  const [addr, nonce, expStr, mac] = token.split(".");
  if (!addr || !nonce || !expStr || !mac) return null;
  const payload = `${addr}.${nonce}.${expStr}`;
  const expected = createHmac("sha256", Buffer.from(secret())).update(payload).digest("hex");
  if (expected !== mac) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const address = addr as Address;
  const message = [
    "Sign in to Buy A Coffee (buyacoffee.perkos.xyz).",
    "",
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(exp).toISOString()}`,
    "",
    "This signature only proves you control this wallet. It does not move funds.",
  ].join("\n");
  return { address, message };
}

/** Verifies the signed challenge. The message is rebuilt from the token, never trusted from the client. */
export async function verifyChallenge(token: string, signature: Hex, claimed: Address): Promise<Address | null> {
  const c = challengeMessageFromToken(token);
  if (!c) return null;
  if (c.address.toLowerCase() !== claimed.toLowerCase()) return null;
  // The message embeds the checksummed/original address the client asked a challenge for.
  const ok = await verifyMessage({ address: claimed, message: c.message.replace(`Wallet: ${c.address}`, `Wallet: ${claimed}`), signature });
  return ok ? (claimed.toLowerCase() as Address) : null;
}

export async function setSession(wallet: Address): Promise<void> {
  const jwt = await new SignJWT({ sub: wallet.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, jwt, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL_SECONDS });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** The signed-in wallet, or null. */
export async function currentWallet(): Promise<Address | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub ? (payload.sub as Address) : null;
  } catch {
    return null;
  }
}

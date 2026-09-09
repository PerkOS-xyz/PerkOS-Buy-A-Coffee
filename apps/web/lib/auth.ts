// Creator sessions: email magic link → signed cookie (HS256, 30 days).
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { consumeLoginToken, createLoginToken, getCreatorById, upsertCreatorByEmail, type Creator } from "./db";

const COOKIE = "bac_session";
const TTL_SECONDS = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueMagicToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await createLoginToken(email, hashToken(token), new Date(Date.now() + 15 * 60 * 1000));
  return token;
}

/** Exchanges a magic token for a creator (creating the row on first login). */
export async function redeemMagicToken(token: string): Promise<Creator | null> {
  const email = await consumeLoginToken(hashToken(token));
  if (!email) return null;
  return upsertCreatorByEmail(email);
}

export async function setSession(creatorId: string): Promise<void> {
  const jwt = await new SignJWT({ sub: creatorId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function currentCreator(): Promise<Creator | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return getCreatorById(payload.sub);
  } catch {
    return null;
  }
}

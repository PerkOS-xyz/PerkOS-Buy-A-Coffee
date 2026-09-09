// Neon Postgres over HTTP. Small typed query helpers instead of an ORM: the
// schema is three tables and every query is a few lines.
import { neon } from "@neondatabase/serverless";

export interface Creator {
  id: string;
  email: string;
  handle: string | null;
  pay_to: string | null;
  display_name: string | null;
  avatar_url: string | null;
  message: string | null;
  default_amounts: number[];
  allowed_origins: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Coffee {
  id: string;
  coffee_id: string;
  creator_id: string | null;
  pay_to: string | null;
  network: string;
  amount: string;
  fee: string | null;
  from_address: string | null;
  tx_hash: string | null;
  status: "pending" | "settled" | "failed";
  memo: string | null;
  return_to: string | null;
  error: string | null;
  created_at: string;
  settled_at: string | null;
}

let client: ReturnType<typeof neon> | null = null;
export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
export const RESERVED_HANDLES = new Set([
  "api", "badge", "dashboard", "login", "logout", "widget.js", "widget", "docs", "about", "admin",
  "perkos", "coffee", "static", "_next", "favicon.ico", "robots.txt", "sitemap.xml", "llms.txt",
]);

export async function getCreatorByHandle(handle: string): Promise<Creator | null> {
  const rows = (await sql()`SELECT * FROM creators WHERE handle = ${handle.toLowerCase()} LIMIT 1`) as Creator[];
  return rows[0] ?? null;
}

export async function getCreatorByEmail(email: string): Promise<Creator | null> {
  const rows = (await sql()`SELECT * FROM creators WHERE email = ${email.toLowerCase()} LIMIT 1`) as Creator[];
  return rows[0] ?? null;
}

export async function getCreatorById(id: string): Promise<Creator | null> {
  const rows = (await sql()`SELECT * FROM creators WHERE id = ${id} LIMIT 1`) as Creator[];
  return rows[0] ?? null;
}

export async function upsertCreatorByEmail(email: string): Promise<Creator> {
  const rows = (await sql()`
    INSERT INTO creators (email) VALUES (${email.toLowerCase()})
    ON CONFLICT (email) DO UPDATE SET updated_at = now()
    RETURNING *`) as Creator[];
  return rows[0];
}

export async function updateCreator(
  id: string,
  patch: Partial<Pick<Creator, "handle" | "pay_to" | "display_name" | "avatar_url" | "message" | "default_amounts" | "allowed_origins" | "active">>,
): Promise<Creator> {
  const rows = (await sql()`
    UPDATE creators SET
      handle = COALESCE(${patch.handle ?? null}, handle),
      pay_to = COALESCE(${patch.pay_to ?? null}, pay_to),
      display_name = COALESCE(${patch.display_name ?? null}, display_name),
      avatar_url = COALESCE(${patch.avatar_url ?? null}, avatar_url),
      message = COALESCE(${patch.message ?? null}, message),
      default_amounts = COALESCE(${patch.default_amounts ? JSON.stringify(patch.default_amounts) : null}::jsonb, default_amounts),
      allowed_origins = COALESCE(${patch.allowed_origins ? JSON.stringify(patch.allowed_origins) : null}::jsonb, allowed_origins),
      active = COALESCE(${patch.active ?? null}, active),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *`) as Creator[];
  return rows[0];
}

export async function insertCoffee(c: {
  coffee_id: string;
  creator_id: string | null;
  pay_to: string;
  network: string;
  amount: string;
  memo: string | null;
  return_to: string | null;
  from_address: string | null;
}): Promise<Coffee> {
  const rows = (await sql()`
    INSERT INTO coffees (coffee_id, creator_id, pay_to, network, amount, memo, return_to, from_address)
    VALUES (${c.coffee_id}, ${c.creator_id}, ${c.pay_to.toLowerCase()}, ${c.network}, ${c.amount}, ${c.memo}, ${c.return_to}, ${c.from_address})
    ON CONFLICT (coffee_id) DO UPDATE SET from_address = COALESCE(EXCLUDED.from_address, coffees.from_address)
    RETURNING *`) as Coffee[];
  return rows[0];
}

export async function getCoffee(coffeeId: string): Promise<Coffee | null> {
  const rows = (await sql()`SELECT * FROM coffees WHERE coffee_id = ${coffeeId} LIMIT 1`) as Coffee[];
  return rows[0] ?? null;
}

export async function markCoffee(
  coffeeId: string,
  patch: { status: Coffee["status"]; tx_hash?: string | null; fee?: string | null; error?: string | null; from_address?: string | null },
): Promise<Coffee> {
  const rows = (await sql()`
    UPDATE coffees SET
      status = ${patch.status},
      tx_hash = COALESCE(${patch.tx_hash ?? null}, tx_hash),
      fee = COALESCE(${patch.fee ?? null}, fee),
      error = ${patch.error ?? null},
      from_address = COALESCE(${patch.from_address ?? null}, from_address),
      settled_at = CASE WHEN ${patch.status} = 'settled' THEN now() ELSE settled_at END
    WHERE coffee_id = ${coffeeId}
    RETURNING *`) as Coffee[];
  return rows[0];
}

export async function listCoffees(creatorId: string, limit = 50): Promise<Coffee[]> {
  return (await sql()`
    SELECT * FROM coffees WHERE creator_id = ${creatorId} ORDER BY created_at DESC LIMIT ${limit}`) as Coffee[];
}

export async function countSettled(creatorId: string): Promise<{ count: number; total: string }> {
  const rows = (await sql()`
    SELECT count(*)::int AS count, COALESCE(sum(amount), 0)::text AS total
    FROM coffees WHERE creator_id = ${creatorId} AND status = 'settled'`) as { count: number; total: string }[];
  return rows[0] ?? { count: 0, total: "0" };
}

export async function countSettledByWallet(payTo: string): Promise<{ count: number; total: string }> {
  const rows = (await sql()`
    SELECT count(*)::int AS count, COALESCE(sum(amount), 0)::text AS total
    FROM coffees WHERE pay_to = ${payTo.toLowerCase()} AND status = 'settled'`) as { count: number; total: string }[];
  return rows[0] ?? { count: 0, total: "0" };
}

export async function createLoginToken(email: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await sql()`INSERT INTO login_tokens (email, token_hash, expires_at) VALUES (${email.toLowerCase()}, ${tokenHash}, ${expiresAt.toISOString()})`;
}

export async function consumeLoginToken(tokenHash: string): Promise<string | null> {
  const rows = (await sql()`
    UPDATE login_tokens SET used_at = now()
    WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
    RETURNING email`) as { email: string }[];
  return rows[0]?.email ?? null;
}

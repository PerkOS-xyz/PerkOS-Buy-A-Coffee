/**
 * Shapes of the two Firestore collections and the pure conversions around
 * them. No Firebase here, so this is unit-tested without credentials.
 *
 * Collections (prefixed, so the data stays recognisable if the project is
 * ever shared with another PerkOS service):
 *   buyacoffee_creators  one document per creator, id = wallet (lowercase)
 *   buyacoffee_coffees   one document per checkout attempt, id = coffee_id
 */

export interface Creator {
  /** The wallet, lowercase. Doubles as the document id. */
  id: string;
  email: string | null;
  wallet: string | null;
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
  /** Same as coffee_id; kept so callers written against the SQL rows still work. */
  id: string;
  coffee_id: string;
  creator_id: string | null;
  pay_to: string | null;
  network: string;
  /** Decimal string, e.g. "5" or "12.5". */
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

export const CREATORS = "buyacoffee_creators";
export const COFFEES = "buyacoffee_coffees";
export const DEFAULT_AMOUNTS = [5, 10, 50];

export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
export const RESERVED_HANDLES = new Set([
  "api", "badge", "dashboard", "login", "logout", "widget.js", "widget", "docs", "about", "admin",
  "perkos", "coffee", "static", "_next", "favicon.ico", "robots.txt", "sitemap.xml", "llms.txt",
]);

export type CreatorPatch = Partial<Pick<Creator, "handle" | "pay_to" | "display_name" | "avatar_url" | "message" | "default_amounts" | "allowed_origins" | "active">>;

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const iso = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") return (v as { toDate: () => Date }).toDate().toISOString();
  return new Date(0).toISOString();
};

/** A creator document as the app reads it; missing fields get the SQL defaults. */
export function toCreator(id: string, d: Record<string, unknown>): Creator {
  return {
    id,
    email: str(d.email),
    wallet: str(d.wallet) ?? id,
    handle: str(d.handle),
    pay_to: str(d.pay_to),
    display_name: str(d.display_name),
    avatar_url: str(d.avatar_url),
    message: str(d.message),
    default_amounts: Array.isArray(d.default_amounts) && d.default_amounts.length ? d.default_amounts.map(Number) : DEFAULT_AMOUNTS,
    allowed_origins: Array.isArray(d.allowed_origins) ? d.allowed_origins.filter((o): o is string => typeof o === "string") : [],
    active: d.active !== false,
    created_at: iso(d.created_at),
    updated_at: iso(d.updated_at),
  };
}

export function toCoffee(id: string, d: Record<string, unknown>): Coffee {
  const status = d.status === "settled" || d.status === "failed" ? d.status : "pending";
  return {
    id,
    coffee_id: str(d.coffee_id) ?? id,
    creator_id: str(d.creator_id),
    pay_to: str(d.pay_to),
    network: str(d.network) ?? "",
    amount: typeof d.amount === "number" ? String(d.amount) : (str(d.amount) ?? "0"),
    fee: typeof d.fee === "number" ? String(d.fee) : str(d.fee),
    from_address: str(d.from_address),
    tx_hash: str(d.tx_hash),
    status,
    memo: str(d.memo),
    return_to: str(d.return_to),
    error: str(d.error),
    created_at: iso(d.created_at),
    settled_at: d.settled_at ? iso(d.settled_at) : null,
  };
}

/** Only the fields a patch names, with null meaning "clear" (SQL COALESCE kept the old value on null; here null is only sent when a caller means it). */
export function creatorUpdate(patch: CreatorPatch, now: string): Record<string, unknown> {
  const out: Record<string, unknown> = { updated_at: now };
  if (patch.handle !== undefined) out.handle = patch.handle;
  if (patch.pay_to !== undefined && patch.pay_to !== null) out.pay_to = patch.pay_to.toLowerCase();
  if (patch.display_name !== undefined) out.display_name = patch.display_name;
  if (patch.avatar_url !== undefined) out.avatar_url = patch.avatar_url;
  if (patch.message !== undefined) out.message = patch.message;
  if (patch.default_amounts !== undefined) out.default_amounts = patch.default_amounts;
  if (patch.allowed_origins !== undefined) out.allowed_origins = patch.allowed_origins;
  if (patch.active !== undefined) out.active = patch.active;
  return out;
}

/** Sum of settled amounts as a decimal string, avoiding float drift on 6-decimal stablecoins. */
export function sumAmounts(amounts: (string | number)[]): string {
  let micro = 0n;
  for (const a of amounts) micro += BigInt(Math.round(Number(a) * 1_000_000));
  const s = micro.toString().padStart(7, "0");
  const whole = s.slice(0, -6);
  const frac = s.slice(-6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Credentials in either of the two shapes used across PerkOS: the one-line
 * JSON `FIREBASE_SERVICE_ACCOUNT` (Stack) or the split
 * `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`
 * (PerkOS API, mini-app). Null when neither is set.
 */
export function parseServiceAccount(env: Record<string, string | undefined>): ServiceAccount | null {
  if (env.FIREBASE_SERVICE_ACCOUNT) {
    const j = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as { project_id: string; client_email: string; private_key: string };
    return { projectId: j.project_id, clientEmail: j.client_email, privateKey: j.private_key };
  }
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: key } = env;
  if (!projectId || !clientEmail || !key) return null;
  // Dashboards and .env files often store the PEM quoted and with literal "\n".
  return { projectId, clientEmail, privateKey: key.replace(/^"|"$/g, "").replace(/\\n/g, "\n") };
}

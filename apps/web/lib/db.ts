// Firestore, through the Admin SDK with the same service account Stack and
// the PerkOS API use (env FIREBASE_SERVICE_ACCOUNT, a JSON string). Without
// it every call throws and the routes fall back to wallet mode, exactly as
// they did without DATABASE_URL. Shapes and pure conversions: lib/dbShape.ts.
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore, type Transaction } from "firebase-admin/firestore";
import { COFFEES, CREATORS, creatorUpdate, parseServiceAccount, sumAmounts, toCoffee, toCreator, type Coffee, type Creator, type CreatorPatch } from "./dbShape";

export { HANDLE_RE, RESERVED_HANDLES, type Coffee, type Creator } from "./dbShape";

let app: App | null = null;
let firestore: Firestore | null = null;

export function db(): Firestore {
  if (!firestore) {
    const sa = parseServiceAccount(process.env);
    if (!sa) throw new Error("Firebase credentials are not set (FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY)");
    if (!app) app = getApps()[0] ?? initializeApp({ credential: cert(sa), projectId: sa.projectId });
    firestore = getFirestore(app);
  }
  return firestore;
}

const now = () => new Date().toISOString();
const creators = () => db().collection(CREATORS);
const coffees = () => db().collection(COFFEES);

async function firstCreator(field: string, value: string): Promise<Creator | null> {
  const snap = await creators().where(field, "==", value).limit(1).get();
  const d = snap.docs[0];
  return d ? toCreator(d.id, d.data()) : null;
}

export function getCreatorByHandle(handle: string) {
  return firstCreator("handle", handle.toLowerCase());
}
export function getCreatorByEmail(email: string) {
  return firstCreator("email", email.toLowerCase());
}
export function getCreatorByWallet(wallet: string) {
  return getCreatorById(wallet.toLowerCase());
}
export async function getCreatorById(id: string): Promise<Creator | null> {
  const d = await creators().doc(id).get();
  return d.exists ? toCreator(d.id, d.data() ?? {}) : null;
}

/** Creates the profile for a wallet on first sign-in; pay_to defaults to the wallet itself. */
export async function upsertCreatorByWallet(wallet: string): Promise<Creator> {
  const w = wallet.toLowerCase();
  const ref = creators().doc(w);
  const t = now();
  await db().runTransaction(async (tx: Transaction) => {
    const cur = await tx.get(ref);
    if (cur.exists) tx.update(ref, { updated_at: t });
    else tx.set(ref, { wallet: w, pay_to: w, email: null, handle: null, active: true, created_at: t, updated_at: t });
  });
  return (await getCreatorById(w)) as Creator;
}

/** Handles are unique: a change is checked and written in one transaction. */
export async function updateCreator(id: string, patch: CreatorPatch): Promise<Creator> {
  const ref = creators().doc(id);
  const update = creatorUpdate(patch, now());
  await db().runTransaction(async (tx: Transaction) => {
    if (typeof patch.handle === "string") {
      const clash = await tx.get(creators().where("handle", "==", patch.handle).limit(1));
      const other = clash.docs.find((d) => d.id !== id);
      if (other) throw new Error("handle taken");
    }
    tx.update(ref, update);
  });
  return (await getCreatorById(id)) as Creator;
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
  const ref = coffees().doc(c.coffee_id);
  await db().runTransaction(async (tx: Transaction) => {
    const cur = await tx.get(ref);
    if (cur.exists) {
      // Same attempt prepared twice: keep the row, fill the payer if it was unknown.
      if (c.from_address && !cur.data()?.from_address) tx.update(ref, { from_address: c.from_address });
      return;
    }
    tx.set(ref, {
      coffee_id: c.coffee_id,
      creator_id: c.creator_id,
      pay_to: c.pay_to.toLowerCase(),
      network: c.network,
      amount: Number(c.amount),
      fee: null,
      from_address: c.from_address,
      tx_hash: null,
      status: "pending",
      memo: c.memo,
      return_to: c.return_to,
      error: null,
      created_at: now(),
      settled_at: null,
    });
  });
  return (await getCoffee(c.coffee_id)) as Coffee;
}

export async function getCoffee(coffeeId: string): Promise<Coffee | null> {
  const d = await coffees().doc(coffeeId).get();
  return d.exists ? toCoffee(d.id, d.data() ?? {}) : null;
}

export async function markCoffee(
  coffeeId: string,
  patch: { status: Coffee["status"]; tx_hash?: string | null; fee?: string | null; error?: string | null; from_address?: string | null },
): Promise<Coffee> {
  const update: Record<string, unknown> = { status: patch.status, error: patch.error ?? null };
  if (patch.tx_hash) update.tx_hash = patch.tx_hash;
  if (patch.fee) update.fee = Number(patch.fee);
  if (patch.from_address) update.from_address = patch.from_address;
  if (patch.status === "settled") update.settled_at = now();
  await coffees().doc(coffeeId).update(update);
  return (await getCoffee(coffeeId)) as Coffee;
}

export async function listCoffees(creatorId: string, limit = 50): Promise<Coffee[]> {
  // Equality filter only (no composite index); ordered here.
  const snap = await coffees().where("creator_id", "==", creatorId).get();
  return snap.docs
    .map((d) => toCoffee(d.id, d.data()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

async function settledTotals(field: "creator_id" | "pay_to", value: string): Promise<{ count: number; total: string }> {
  const snap = await coffees().where(field, "==", value).where("status", "==", "settled").select("amount").get();
  return { count: snap.size, total: sumAmounts(snap.docs.map((d) => d.get("amount") ?? 0)) };
}

export function countSettled(creatorId: string) {
  return settledTotals("creator_id", creatorId);
}
export function countSettledByWallet(payTo: string) {
  return settledTotals("pay_to", payTo.toLowerCase());
}

import assert from "node:assert/strict";
import test from "node:test";
import { toCreator, toCoffee, creatorUpdate, sumAmounts, parseServiceAccount, DEFAULT_AMOUNTS, HANDLE_RE, RESERVED_HANDLES } from "../lib/dbShape.ts";

test("a bare creator document gets the SQL defaults", () => {
  const c = toCreator("0xabc", { wallet: "0xabc", pay_to: "0xabc", created_at: "2026-09-10T00:00:00.000Z" });
  assert.equal(c.id, "0xabc");
  assert.deepEqual(c.default_amounts, DEFAULT_AMOUNTS);
  assert.deepEqual(c.allowed_origins, []);
  assert.equal(c.active, true);
  assert.equal(c.handle, null);
  assert.equal(c.updated_at, "1970-01-01T00:00:00.000Z", "missing timestamps do not throw");
});

test("creator fields round-trip, active false is kept, Firestore Timestamps become ISO", () => {
  const ts = { toDate: () => new Date("2026-09-10T12:00:00.000Z") };
  const c = toCreator("0xabc", { handle: "julio", default_amounts: [3, 7], allowed_origins: ["https://a.example", 5], active: false, created_at: ts });
  assert.equal(c.handle, "julio");
  assert.deepEqual(c.default_amounts, [3, 7]);
  assert.deepEqual(c.allowed_origins, ["https://a.example"]);
  assert.equal(c.active, false);
  assert.equal(c.created_at, "2026-09-10T12:00:00.000Z");
});

test("coffee amounts are decimal strings whatever Firestore stored", () => {
  const a = toCoffee("c1", { amount: 12.5, status: "settled", settled_at: "2026-09-10T12:00:00.000Z" });
  assert.equal(a.amount, "12.5");
  assert.equal(a.status, "settled");
  assert.equal(a.coffee_id, "c1");
  const b = toCoffee("c2", { amount: "5", status: "weird" });
  assert.equal(b.amount, "5");
  assert.equal(b.status, "pending", "unknown status reads as pending");
  assert.equal(b.settled_at, null);
});

test("a patch only writes what it names and lowercases pay_to", () => {
  const u = creatorUpdate({ pay_to: "0xABC", display_name: "J", avatar_url: null }, "t");
  assert.deepEqual(u, { updated_at: "t", pay_to: "0xabc", display_name: "J", avatar_url: null });
  assert.deepEqual(creatorUpdate({}, "t"), { updated_at: "t" });
});

test("settled totals add exactly in 6-decimal units", () => {
  assert.equal(sumAmounts([0.1, 0.2]), "0.3");
  assert.equal(sumAmounts(["5", 10, 50.25]), "65.25");
  assert.equal(sumAmounts([]), "0");
});

test("handle rules are unchanged", () => {
  assert.ok(HANDLE_RE.test("juliomcruz"));
  assert.ok(!HANDLE_RE.test("-bad"));
  assert.ok(RESERVED_HANDLES.has("api"));
});

test("credentials are read in Stack's JSON shape or the API's split shape", () => {
  assert.equal(parseServiceAccount({}), null);
  assert.equal(parseServiceAccount({ FIREBASE_PROJECT_ID: "p" }), null, "split shape needs all three");
  const json = parseServiceAccount({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: "p", client_email: "e", private_key: "-----BEGIN\nX\n-----END" }) });
  assert.deepEqual(json, { projectId: "p", clientEmail: "e", privateKey: "-----BEGIN\nX\n-----END" });
  const split = parseServiceAccount({ FIREBASE_PROJECT_ID: "p", FIREBASE_CLIENT_EMAIL: "e", FIREBASE_PRIVATE_KEY: '"-----BEGIN\\nX\\n-----END"' });
  assert.deepEqual(split, json, "quotes stripped, literal backslash-n unescaped");
});

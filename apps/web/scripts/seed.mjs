// Seeds the first creator (idempotent: re-runs only refresh the profile fields).
// Credentials from the environment or apps/web/.env: FIREBASE_SERVICE_ACCOUNT (JSON)
// or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const envFile = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^(FIREBASE_[A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^'(.*)'$/s, "$1").replace(/^"(.*)"$/s, "$1");
  }
}
let sa;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const j = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  sa = { projectId: j.project_id, clientEmail: j.client_email, privateKey: j.private_key };
} else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  sa = { projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
} else {
  console.error("Firebase credentials are not set");
  process.exit(1);
}
const app = getApps()[0] ?? initializeApp({ credential: cert(sa), projectId: sa.projectId });
const db = getFirestore(app);

const wallet = "0xc2564e41b7f5cb66d2d99466450cfebce9e8228f";
const now = new Date().toISOString();
const ref = db.collection("buyacoffee_creators").doc(wallet);
const cur = await ref.get();
await ref.set(
  {
    wallet,
    email: "julio.cruz@eb-ms.net",
    handle: "juliomcruz",
    pay_to: wallet,
    display_name: "Julio M Cruz",
    avatar_url: "https://www.juliomcruz.xyz/julio-320.jpg",
    message: "Senior software engineer. 25 years of production systems, six under a Top Secret clearance, AI-agent infrastructure today. If something here helped you, a coffee is welcome.",
    default_amounts: [5, 10, 50],
    allowed_origins: ["https://www.juliomcruz.xyz", "https://juliomcruz.xyz", "https://github.com"],
    active: true,
    updated_at: now,
    ...(cur.exists ? {} : { created_at: now }),
  },
  { merge: true },
);
console.log(`${cur.exists ? "refreshed" : "created"} creator juliomcruz (${wallet}) in project ${sa.projectId}`);

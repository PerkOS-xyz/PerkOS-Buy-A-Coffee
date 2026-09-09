// Applies drizzle/*.sql in order. Idempotent: every statement uses IF NOT EXISTS.
import { neon } from "@neondatabase/serverless";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
const sql = neon(url);
const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle");
for (const f of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) {
  const text = readFileSync(resolve(dir, f), "utf8");
  for (const stmt of text.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) {
    await sql.query(stmt);
  }
  console.log("applied", f);
}

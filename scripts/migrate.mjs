/**
 * Lightweight migration runner for Docker / Railway.
 *
 * Reads Drizzle's _journal.json and applies any SQL files that haven't been
 * recorded in the __drizzle_migrations table yet.  Uses the `postgres` driver
 * directly — no drizzle-kit dependency required in the production image.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = join(__dirname, "..", "drizzle");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — skipping migrations.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

try {
  // Ensure the migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id       SERIAL PRIMARY KEY,
      tag      TEXT   NOT NULL UNIQUE,
      applied  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Read the Drizzle journal
  const journal = JSON.parse(
    readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf-8"),
  );

  // Find which migrations have already been applied
  const applied = await sql`SELECT tag FROM __drizzle_migrations`;
  const appliedTags = new Set(applied.map((r) => r.tag));

  let count = 0;
  for (const entry of journal.entries) {
    if (appliedTags.has(entry.tag)) continue;

    const filePath = join(DRIZZLE_DIR, `${entry.tag}.sql`);
    const migration = readFileSync(filePath, "utf-8");

    console.log(`Applying migration: ${entry.tag}`);

    await sql.begin(async (tx) => {
      // Split on breakpoints (Drizzle uses --> statement-breakpoint)
      const statements = migration
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        await tx.unsafe(stmt);
      }

      await tx`INSERT INTO __drizzle_migrations (tag) VALUES (${entry.tag})`;
    });

    count++;
  }

  if (count === 0) {
    console.log("Database is up to date — no migrations to apply.");
  } else {
    console.log(`Applied ${count} migration(s) successfully.`);
  }
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}

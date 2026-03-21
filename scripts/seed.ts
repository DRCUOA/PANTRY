import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { userSettings, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

async function main() {
  const email = process.env.SEED_EMAIL ?? "dev@example.com";
  const password = process.env.SEED_PASSWORD ?? "devpassword123";
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    console.log("Seed user already exists:", email);
    return;
  }
  const passwordHash = await hashPassword(password);
  const [u] = await db.insert(users).values({ email, passwordHash, name: "Dev" }).returning();
  await db.insert(userSettings).values({
    userId: u.id,
    defaultLocation: "Fridge",
  });
  console.log("Created user", email, "password:", password);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

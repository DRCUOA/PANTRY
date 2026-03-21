import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: Db | null = null;

export function getDb(): Db {
  if (dbInstance) return dbInstance;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  client = postgres(connectionString, { max: 10 });
  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "../env.js";
import * as schema from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof schema>;

// Reuse one pool across dev hot reloads.
const globalForDb = globalThis as unknown as { quattroDb?: Database };

function createDb(): Database {
  const client = postgres(serverEnv().DATABASE_URL, { max: 10 });
  return drizzle(client, { schema, casing: "snake_case" });
}

/** Lazily connects, so tooling that never queries doesn't need DATABASE_URL. */
export function db(): Database {
  globalForDb.quattroDb ??= createDb();
  return globalForDb.quattroDb;
}

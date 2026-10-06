/**
 * Local development database — a real PostgreSQL that lives inside the project.
 *
 *   npm run db:start           start it (first run: create, migrate, seed demo data)
 *   npm run db:start -- --reset  delete it and start over from scratch
 *
 * Data lives in .postgres/ (gitignored). It is disposable: production has its
 * own database in Docker and never sees any of this. Listens on localhost only.
 */
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";
import * as schema from "../server/db/schema";
import { ensureExampleMedia } from "./example-media";
import { seedDemo } from "./seed-demo";

// Local-only credentials. Not a secret: the server only accepts connections from this machine.
export const LOCAL_DB = {
  port: 5433,
  user: "quattro",
  password: "quattro",
  database: "quattro",
};
export const LOCAL_DATABASE_URL = `postgres://${LOCAL_DB.user}:${LOCAL_DB.password}@localhost:${LOCAL_DB.port}/${LOCAL_DB.database}`;

const dataDir = path.resolve(".postgres");

async function main() {
  if (process.argv.includes("--reset")) {
    await rm(dataDir, { recursive: true, force: true });
    console.log("✓ local database deleted");
  }

  const firstRun = !existsSync(path.join(dataDir, "PG_VERSION"));

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: LOCAL_DB.port,
    user: LOCAL_DB.user,
    password: LOCAL_DB.password,
    authMethod: "scram-sha-256",
    persistent: true,
    // Without this, initdb inherits the Windows code page (WIN1252), which cannot
    // store Arabic, emoji or many symbols. Production (Docker) is UTF-8; match it.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=localhost"],
    onLog: () => {},
    onError: (error) => console.error("[postgres]", error),
  });

  if (firstRun) {
    console.log("Creating local database (first run only)…");
    await pg.initialise();
  }

  await pg.start();
  if (firstRun) await pg.createDatabase(LOCAL_DB.database);

  // Always bring the schema up to date, so pulling new migrations just works.
  const client = postgres(LOCAL_DATABASE_URL, { max: 1, onnotice: () => {} });
  const [{ server_encoding: encoding } = { server_encoding: "?" }] =
    await client`show server_encoding`;
  if (encoding !== "UTF8") {
    await client.end();
    await pg.stop();
    throw new Error(
      `The local database uses ${encoding}, not UTF-8, so it can't store Arabic text. ` +
        "Recreate it with: npm run db:start -- --reset",
    );
  }
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

  if (firstRun) {
    await seedDemo(drizzle(client, { schema, casing: "snake_case" }));
    console.log("✓ example catalog seeded (12 products, all flagged as demo)");
    await ensureExampleMedia({ quiet: true });
  }
  await client.end();

  console.log(`\n✓ PostgreSQL running on localhost:${LOCAL_DB.port}`);
  console.log(`  DATABASE_URL=${LOCAL_DATABASE_URL}`);
  console.log("  Press Ctrl+C to stop.\n");

  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  // Keep the process alive; Postgres stops when this script exits.
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

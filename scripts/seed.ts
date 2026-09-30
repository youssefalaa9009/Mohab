/**
 * npm run db:seed            → (re)creates the demo catalog
 * npm run db:seed -- --clean → removes all demo data (run before launch)
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { cleanDemo, seedDemo } from "./seed-demo";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema, casing: "snake_case" });

  if (process.argv.includes("--clean")) {
    await cleanDemo(db);
    console.log("✓ demo data removed");
  } else {
    await seedDemo(db);
    console.log("✓ demo catalog seeded (12 products, flagged is_demo)");
  }
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

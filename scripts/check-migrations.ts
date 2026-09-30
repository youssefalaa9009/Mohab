/**
 * Applies every migration to a throwaway in-memory Postgres (PGlite) to prove the SQL is valid,
 * then runs a few constraint smoke tests. Needs no database server — safe for CI.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/lib/db/schema";
import { cleanDemo, seedDemo } from "./seed-demo";

async function expectFailure(label: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch {
    console.log(`  ✓ rejected: ${label}`);
    return;
  }
  throw new Error(`Constraint not enforced: ${label}`);
}

async function main() {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });

  const { rows } = await client.query<{ count: number }>(
    "select count(*)::int as count from information_schema.tables where table_schema = 'public'",
  );
  console.log(`✓ migrations applied — ${rows[0]?.count} tables`);

  await client.exec(`
    insert into categories (id, slug, name) values ('00000000-0000-0000-0000-000000000001', 'tees', 'Tees');
    insert into products (id, slug, name, category_id)
      values ('00000000-0000-0000-0000-000000000002', 'p', 'P', '00000000-0000-0000-0000-000000000001');
  `);
  const product = "'00000000-0000-0000-0000-000000000002'";

  await expectFailure("negative stock", () =>
    client.exec(`insert into variants (product_id, sku, price, stock) values (${product}, 'A', 100, -1)`),
  );
  await expectFailure("compare-at price not above price", () =>
    client.exec(
      `insert into variants (product_id, sku, price, compare_at_price) values (${product}, 'B', 100, 100)`,
    ),
  );
  await client.exec(`insert into variants (product_id, sku, price) values (${product}, 'C', 100)`);
  await expectFailure("duplicate one-size variant (nulls not distinct)", () =>
    client.exec(`insert into variants (product_id, sku, price) values (${product}, 'D', 100)`),
  );
  await expectFailure("lower-case coupon code", () =>
    client.exec(`insert into coupons (code, type, value) values ('save10', 'percent', 10)`),
  );
  await expectFailure("percent coupon over 100", () =>
    client.exec(`insert into coupons (code, type, value) values ('BIG', 'percent', 150)`),
  );

  const order = await client.query<{ number: string }>(`
    insert into orders (email, phone, status, payment_method, subtotal, total, shipping_address)
    values ('a@b.co', '01000000000', 'awaiting_confirmation', 'cod', 100, 100, '{}')
    returning number`);
  if (order.rows[0]?.number !== "Q-10001") throw new Error("Order numbering is wrong");
  console.log(`  ✓ first order number: ${order.rows[0].number}`);

  await client.close();
  console.log("✓ schema checks passed");

  // Seed on a fresh database: twice (must be re-runnable), then clean.
  const seedClient = new PGlite();
  const seedDb = drizzle(seedClient, { schema, casing: "snake_case" });
  await migrate(seedDb, { migrationsFolder: "./drizzle" });
  await seedDemo(seedDb);
  await seedDemo(seedDb);
  const counts = await seedClient.query<{ products: number; variants: number; images: number }>(`
    select (select count(*) from products)::int as products,
           (select count(*) from variants)::int as variants,
           (select count(*) from product_images)::int as images`);
  console.log(`✓ demo seed re-runnable — ${JSON.stringify(counts.rows[0])}`);
  await cleanDemo(seedDb);
  const left = await seedClient.query<{ n: number }>(
    "select (select count(*) from products) + (select count(*) from categories) as n",
  );
  if (Number(left.rows[0]?.n) !== 0) throw new Error("cleanDemo left data behind");
  console.log("✓ demo clean removes everything");
  await seedClient.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

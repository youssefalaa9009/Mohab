/**
 * Remove products the e2e suite created in earlier runs. Refuses to run
 * against anything but a local database.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`e2e-reset refuses to touch a non-local database (${host || "no DATABASE_URL"}).`);
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const products =
  await sql`delete from products where name like 'E2E %' or slug = 'admin-test-tee' returning id`;
const rates = await sql`delete from shipping_rates where name like 'E2E %' returning id`;
const coupons = await sql`delete from coupons where code like 'E2E%' returning id`;
await sql`delete from contact_messages where subject like 'E2E %'`;
await sql`delete from newsletter_subscribers where email like 'e2e-news-%@quattro.test'`;
// InstaPay settings left on by instapay.spec (only the e2e test address).
await sql`delete from store_settings where key = 'payments' and value->'instapay'->>'address' = 'e2e-store@instapay'`;
// Shopper accounts from account.spec (their orders stay, unlinked).
const users =
  await sql`delete from "user" where email like 'e2e-shopper-%@quattro.test' returning id`;
await sql.end();
console.log(
  `✓ removed leftovers from earlier e2e runs: ${products.length} products, ${rates.length} rates, ${coupons.length} codes, ${users.length} shoppers`,
);

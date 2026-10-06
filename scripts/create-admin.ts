/**
 * Create a staff account, or promote an existing one.
 *
 *   npm run admin:create -- --email you@example.com --name "Your Name"
 *
 * The password is read from the ADMIN_PASSWORD environment variable or asked
 * for interactively, so it never lands in shell history.
 */
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { auth } from "../server/auth";
import { db } from "../server/db/client";
import { user } from "../server/db/schema";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const email = arg("email")?.toLowerCase();
  const name = arg("name") ?? "QUATTRO staff";
  if (!email)
    throw new Error('Usage: npm run admin:create -- --email you@example.com --name "Name"');

  const [existing] = await db().select().from(user).where(eq(user.email, email)).limit(1);
  if (!existing) {
    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      password = await rl.question("Password (min 10 characters): ");
      rl.close();
    }
    await auth().api.signUpEmail({ body: { email, password, name } });
    console.log(`✓ created ${email}`);
  }

  await db().update(user).set({ role: "admin" }).where(eq(user.email, email));
  console.log(`✓ ${email} is now an admin`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

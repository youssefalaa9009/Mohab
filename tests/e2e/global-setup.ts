import { execSync } from "node:child_process";

export const E2E_ADMIN = { email: "e2e-admin@quattro.test", password: "e2e-admin-password-1" };

/**
 * Reset the demo catalog so stock levels are the same at the start of every
 * run, and make sure the staff account the admin tests sign in with exists.
 */
export default function globalSetup() {
  execSync("npx tsx --env-file-if-exists=.env.local scripts/e2e-reset.ts", { stdio: "inherit" });
  execSync("npm run db:seed", { stdio: "inherit" });
  execSync(`npm run admin:create -- --email ${E2E_ADMIN.email} --name "E2E Admin"`, {
    stdio: "inherit",
    env: { ...process.env, ADMIN_PASSWORD: E2E_ADMIN.password },
  });
}

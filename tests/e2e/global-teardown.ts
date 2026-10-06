import { execSync } from "node:child_process";

/**
 * Remove what the suite created (test products, shoppers, the e2e InstaPay
 * settings), so the local site looks as it did before the run.
 */
export default function globalTeardown() {
  execSync("npx tsx --env-file-if-exists=.env.local scripts/e2e-reset.ts", { stdio: "inherit" });
}

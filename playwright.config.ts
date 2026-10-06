import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real stack (Fastify + SSR + local PostgreSQL
 * with the demo catalog). `npm run test:e2e` starts it if it isn't running.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The dev server serves every module unbundled (hundreds per page); more than
  // two browsers at once can exhaust Chromium's resources on a modest machine.
  workers: 2,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.QUATTRO_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:all",
    url: "http://localhost:3000/api/healthz",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});

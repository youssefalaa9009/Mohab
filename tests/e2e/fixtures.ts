import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every test fails if the page logs an error or throws — hydration mismatches,
 * CSP violations and React warnings would otherwise pass silently.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        // The browser logs every 4xx/5xx response as "Failed to load resource".
        // Expected HTTP failures (404 pages, rejected codes) are asserted by the
        // tests themselves; only errors raised by application code count here.
        // Vite's hot-reload socket is dev-server plumbing that production doesn't have.
        const text = message.text();
        if (text.includes("WebSocket connection to 'ws://localhost:24678")) return;
        if (message.type() === "error" && !text.startsWith("Failed to load resource")) {
          errors.push(text);
        }
      });
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

/** Wait until React has hydrated, so clicks reach JavaScript handlers rather than plain links. */
export async function hydrated(page: Page) {
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}

export { expect };

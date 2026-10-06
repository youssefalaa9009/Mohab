/**
 * Captures review screenshots and asserts the page hydrates cleanly.
 *
 * Run against a server you started yourself:
 *   QUATTRO_URL=http://127.0.0.1:5190 npx tsx scripts/review-shots.ts
 */
import { mkdir } from "node:fs/promises";
import { chromium, type ConsoleMessage } from "@playwright/test";

const BASE = process.env.QUATTRO_URL ?? "http://127.0.0.1:3000";
const OUT = process.env.QUATTRO_SHOTS ?? "review";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const PAGES = [
  { name: "home", path: "/" },
  { name: "shop", path: "/shop" },
  { name: "category", path: "/shop/hoodies" },
  { name: "product", path: "/products/loopback-hoodie" },
  { name: "collections", path: "/collections" },
  { name: "cart", path: "/cart" },
  { name: "design", path: "/design" },
  { name: "about", path: "/about" },
  { name: "contact", path: "/contact" },
  { name: "faq", path: "/faq" },
  { name: "track-order", path: "/help/track-order" },
  { name: "cookies", path: "/legal/cookies" },
  { name: "wishlist", path: "/wishlist" },
  { name: "not-found", path: "/nope" },
] as const;

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems: string[] = [];

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
    });

    for (const page of PAGES) {
      const tab = await context.newPage();
      const messages: string[] = [];
      const collect = (msg: ConsoleMessage) => {
        const text = msg.text();
        // The 404 page is *meant* to be served with a 404 status.
        const expected404 = page.name === "not-found" && text.includes("status of 404");
        if ((msg.type() === "error" || msg.type() === "warning") && !expected404) {
          messages.push(`${msg.type()}: ${text}`);
        }
      };
      tab.on("console", collect);
      tab.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));

      await tab.goto(`${BASE}${page.path}`, { waitUntil: "networkidle" });

      // React Router only attaches this once hydration has run.
      const hydrated = await tab.evaluate(
        () =>
          document.documentElement.hasAttribute("data-react-router") ||
          Boolean(document.querySelector("[data-discover]")),
      );
      if (!hydrated && page.name !== "not-found") {
        problems.push(`${page.name}/${viewport.name}: no hydration marker found`);
      }

      for (const message of messages) {
        problems.push(`${page.name}/${viewport.name} ${message}`);
      }

      // Scroll the whole page so on-scroll reveals actually run, then return to
      // the top and let the last animations settle before capturing.
      await tab.evaluate(async () => {
        const step = window.innerHeight * 0.75;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
        window.scrollTo(0, 0);
      });
      await tab.waitForTimeout(1200);

      await tab.screenshot({
        path: `${OUT}/${page.name}-${viewport.name}.png`,
        fullPage: true,
      });
      console.log(`✓ ${page.name} @ ${viewport.name}`);
      await tab.close();
    }

    await context.close();
  }

  await browser.close();

  if (problems.length) {
    console.error("\nProblems found:");
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    process.exit(1);
  }
  console.log("\n✓ no console errors or warnings; pages hydrated");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

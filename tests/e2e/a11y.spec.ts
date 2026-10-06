import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";
import { expect, hydrated, test } from "./fixtures";

/** Storefront pages audited against WCAG 2.1 A/AA with axe-core. */
const PAGES = [
  "/",
  "/shop",
  "/shop/hoodies",
  "/products/loopback-hoodie",
  "/collections",
  "/search?q=hoodie",
  "/cart",
  "/wishlist",
  "/account/login",
  "/account/register",
  "/about",
  "/contact",
  "/faq",
  "/help/track-order",
  "/legal/cookies",
  "/nope",
];

test.describe("accessibility", () => {
  for (const path of PAGES) {
    test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
      // Reduced motion shows reveal animations in their final state, so contrast
      // is measured on what people read rather than on a half-faded frame.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      await hydrated(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      // Readable failure output: rule, impact and the first offending selectors.
      const violations = results.violations.map((violation) => ({
        rule: violation.id,
        impact: violation.impact,
        help: violation.help,
        targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
      }));
      expect(violations).toEqual([]);
    });
  }
});

async function audit(page: Page) {
  await hydrated(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.map((violation) => ({
    rule: violation.id,
    help: violation.help,
    targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
  }));
}

test.describe("accessibility (stateful pages)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("checkout with a bag", async ({ page }) => {
    await page.goto("/products/loopback-hoodie");
    await hydrated(page);
    await page.locator('label:has(input[name="size"][value="M"])').click();
    await page.getByRole("button", { name: "Add to bag" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await audit(page)).toEqual([]);
    await page.goto("/checkout");
    expect(await audit(page)).toEqual([]);
  });

  test("admin pages", async ({ page }) => {
    // Eleven pages audited in one session.
    test.slow();
    await page.goto("/admin/login");
    expect(await audit(page)).toEqual([]);
    await page.getByLabel("Email").fill(E2E_ADMIN.email);
    await page.getByLabel("Password").fill(E2E_ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/admin");
    for (const path of [
      "/admin",
      "/admin/orders",
      "/admin/products",
      "/admin/products/new",
      "/admin/discounts",
      "/admin/delivery",
      "/admin/catalog",
      "/admin/customers",
      "/admin/messages",
      "/admin/newsletter",
    ]) {
      await page.goto(path);
      expect(await audit(page), path).toEqual([]);
    }
  });
});

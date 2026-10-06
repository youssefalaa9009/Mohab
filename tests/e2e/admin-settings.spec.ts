import type { Page } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";
import { expect, test } from "./fixtures";

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("delivery rates and discount codes set in admin reach checkout", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "admin is a desktop workflow");
  // Two sessions and several pages: longer than the 30s default, especially on a cold dev server.
  test.setTimeout(90_000);
  const rateName = `E2E Cairo courier ${Date.now()}`;
  const code = `E2E${Date.now().toString().slice(-6)}`;

  await signIn(page);
  await page.goto("/admin/delivery");
  const newRate = page.locator("form").filter({ hasText: "New rate — name" });
  await newRate.getByLabel("New rate — name").fill(rateName);
  await newRate.getByRole("combobox", { name: /^Governorate/ }).selectOption("Cairo");
  await newRate.getByLabel("Price (EGP)").fill("60");
  await newRate.getByLabel("Min days").fill("1");
  await newRate.getByLabel("Max days").fill("2");
  // Positioned after the demo rate so other tests' default stays the demo one.
  await newRate.getByLabel("Order").fill("5");
  await newRate.getByRole("button", { name: "Add" }).click();
  await expect(page.locator(`input[value="${rateName}"]`)).toBeVisible();

  await page.goto("/admin/discounts");
  await page.getByRole("button", { name: "New code" }).click();
  await page.getByLabel("Code").fill(code);
  await page.getByLabel("Percent", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Save code" }).click();
  await expect(page.getByRole("cell", { name: code })).toBeVisible();

  // A shopper in a separate session (own cookies) sees both.
  const shopperContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const shopper = await shopperContext.newPage();
  await shopper.goto("/products/ribbed-beanie"); // one size: no size to pick
  await shopper.getByRole("button", { name: "Add to bag" }).click();
  const drawer = shopper.getByRole("dialog");
  await drawer.getByLabel("Promo code").fill(code.toLowerCase());
  await drawer.getByRole("button", { name: "Apply" }).click();
  await expect(drawer.getByText(`Code ${code} — 15% off`)).toBeVisible();

  await shopper.goto("/checkout");
  await shopper.getByLabel("Governorate").selectOption("Cairo");
  const option = shopper.getByRole("radio", { name: new RegExp(rateName) });
  await expect(option).toBeVisible();
  await option.check();
  await expect(shopper.getByText("1–2 business days")).toBeVisible();

  // Elsewhere, the Cairo-only rate isn't offered.
  await shopper.getByLabel("Governorate").selectOption("Aswan");
  await expect(shopper.getByRole("radio", { name: /Standard delivery/ })).toBeVisible();
  await expect(shopper.getByRole("radio", { name: new RegExp(rateName) })).toHaveCount(0);
  await shopperContext.close();
});

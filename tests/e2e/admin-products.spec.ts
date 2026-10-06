import type { Page } from "@playwright/test";
import sharp from "sharp";
import { E2E_ADMIN } from "./global-setup";
import { expect, test } from "./fixtures";

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("creates, stocks, photographs and publishes a product", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "admin is a desktop workflow");
  const photo = testInfo.outputPath("photo.jpg"); // creates the output folder
  await sharp({ create: { width: 1600, height: 2000, channels: 3, background: "#6e675d" } })
    .jpeg()
    .toFile(photo);
  const name = `E2E Overshirt ${Date.now()}`;

  await signIn(page);
  await page.goto("/admin/products/new");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Publishing without a sellable variant is refused.
  await page.getByLabel("Status").selectOption("active");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Add at least one active variant")).toBeVisible();

  await page.getByLabel("Colour name").fill("Stone");
  await page.getByRole("button", { name: "Add colour" }).click();
  await expect(page.getByRole("button", { name: "Delete Stone" })).toBeVisible();

  await page.getByLabel("Sizes (comma separated, empty = one size)").fill("s, m");
  await page.getByLabel("Price (EGP)").fill("1450");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByRole("textbox", { name: "SKU for Stone · M" })).toBeVisible();

  const row = page.getByRole("row", { name: /Stone · M/ });
  await row.getByRole("button", { name: "Adjust" }).click();
  await page.getByLabel("Quantity").fill("8");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(row.getByRole("cell", { name: /^8/ })).toBeVisible();

  await page.getByLabel("Image file").setInputFiles(photo);
  await page.getByLabel("Describe it (alt text)").fill("Overshirt, front view");
  // A select wrapped in its label is named "Colour <selected option>", hence the prefix match.
  await page
    .getByRole("combobox", { name: /^Colour/ })
    .last()
    .selectOption({ label: "Stone" });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("img", { name: "Overshirt, front view" })).toBeVisible();

  await page.getByLabel("Status").selectOption("active");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("link", { name: "View on store" })).toBeVisible();

  // Live on the storefront, with its real photo.
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await page.goto(`/products/${slug}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("EGP 1,450").first()).toBeVisible();
  await expect(page.locator('img[srcset*="/media/products/"]').first()).toBeVisible();
});

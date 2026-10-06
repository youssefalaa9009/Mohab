import { expect, test } from "./fixtures";

const save = (name: string) => ({ name: `Save ${name}`, exact: true });

test.describe("wishlist", () => {
  test("guests save pieces in this browser", async ({ page }) => {
    await page.goto("/shop");
    const heart = page.getByRole("button", save("Boxy Tee"));
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('header a[href="/wishlist"]')).toHaveAttribute(
      "aria-label",
      "Wishlist, 1 saved",
    );

    await page.goto("/wishlist");
    await expect(page.getByText("Saved on this device.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Boxy Tee" })).toBeVisible();

    // Survives a reload; un-hearting removes it.
    await page.reload();
    await page.getByRole("button", save("Boxy Tee")).click();
    await expect(page.getByText("Nothing saved yet.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Nothing saved yet.")).toBeVisible();
  });

  test("a guest's saves move to the account on sign-up and follow it", async ({ page }) => {
    await page.goto("/products/oversized-hoodie");
    await page.getByRole("button", save("Oversized Hoodie")).click();
    await expect(page.getByRole("button", save("Oversized Hoodie"))).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const email = `e2e-shopper-${Date.now()}-${Math.floor(Math.random() * 1e6)}@quattro.test`;
    await page.goto("/account/register");
    const main = page.getByRole("main");
    await main.getByLabel("Full name", { exact: true }).fill("E2E Wisher");
    await main.getByLabel("Email", { exact: true }).fill(email);
    await main.getByLabel("Password", { exact: true }).fill("e2e-shopper-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Hello, E2E" })).toBeVisible();

    await page.goto("/wishlist");
    await expect(page.getByRole("link", { name: "Oversized Hoodie" })).toBeVisible();
    await expect(page.getByText("Saved on this device.")).toHaveCount(0);

    // Saved on the account now: the browser copy was handed over and cleared.
    const stored = await page.evaluate(() => localStorage.getItem("quattro:wishlist"));
    expect(stored).toBeNull();
    const saved = await (await page.request.get("/api/wishlist")).json();
    expect(saved.signedIn).toBe(true);
    expect(saved.ids).toHaveLength(1);

    await page.goto("/products/zip-hoodie");
    await page.getByRole("button", save("Zip Hoodie")).click();
    await expect(page.getByRole("button", save("Zip Hoodie"))).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.goto("/wishlist");
    await expect(page.getByRole("link", { name: /^(Oversized Hoodie|Zip Hoodie)$/ })).toHaveCount(
      2,
    );

    await page.getByRole("button", save("Oversized Hoodie")).click();
    await expect(page.getByRole("link", { name: "Oversized Hoodie" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("link", { name: "Zip Hoodie" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Oversized Hoodie" })).toHaveCount(0);
  });
});
